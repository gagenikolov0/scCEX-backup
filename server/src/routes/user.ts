import { Router, type Request, type Response } from 'express'
import { requireAuth, type AuthRequest } from '../middleware/auth'
import { User } from '../models/User'
import SpotPosition from '../models/SpotPosition'
import { FuturesAccount } from '../models/FuturesAccount'
import { FuturesPosition } from '../models/FuturesPosition'
import { AddressGroup } from '../models/AddressGroup'
import { moveMoney } from '../utils/moneyMovement'
import { syncStableBalances, syncFuturesBalances } from '../utils/emitters'
import { calculateTotalPortfolioUSD, calculateSpotEquity } from '../utils/portfolio'
import { FuturesPositionHistory } from '../models/FuturesPositionHistory'
import mongoose from "mongoose";
import { profileLimiter, discoveryLimiter, financeLimiter } from '../middleware/rateLimiter'
import { FuturesActivity } from '../models/FuturesActivity'
import { Withdrawal } from '../models/Withdrawal'
import { futuresPnlService } from '../utils/pnlService';

const router = Router();

router.patch("/profile", requireAuth, profileLimiter, async (req: AuthRequest, res: Response) => {
  const { username, profilePicture } = req.body || {}
  const updates: any = {}

  if (username !== undefined) {
    if (typeof username !== 'string' || username.length < 3 || username.length > 20) {
      return res.status(400).json({ error: "Username must be between 3 and 20 characters" })
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({ error: "Username can only contain letters, numbers, and underscores" })
    }
    updates.username = username
  }

  if (profilePicture !== undefined) {
    // Tighten limit for optimized 512px JPEG (~200KB max, but allowing head room for base64)
    if (profilePicture && profilePicture.length > 250 * 1024) {
      return res.status(400).json({ error: "Profile picture too large (max 250KB after optimization)" })
    }
    updates.profilePicture = profilePicture
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No fields to update" })
  }

  try {
    const userId = req.user!.id
    const user = await User.findById(userId)

    if (updates.username) {
      if (user?.lastUsernameChange) {
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        if (user.lastUsernameChange > sevenDaysAgo) {
          const nextAvailable = new Date(user.lastUsernameChange)
          nextAvailable.setDate(nextAvailable.getDate() + 7)
          return res.status(429).json({
            error: `Username can only be changed once every week. Next available: ${nextAvailable.toLocaleDateString()}`
          })
        }
      }

      const existing = await User.findOne({ username: updates.username, _id: { $ne: userId } }).lean()
      if (existing) {
        return res.status(409).json({ error: "Username already taken" })
      }
      updates.lastUsernameChange = new Date()
    }

    if (updates.profilePicture !== undefined) {
      if (user?.lastPfpChange) {
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        if (user.lastPfpChange > sevenDaysAgo) {
          const nextAvailable = new Date(user.lastPfpChange)
          nextAvailable.setDate(nextAvailable.getDate() + 7)
          return res.status(429).json({
            error: `Profile picture can only be changed once every week. Next available: ${nextAvailable.toLocaleDateString()}`
          })
        }
      }
      updates.lastPfpChange = new Date()
    }

    await User.updateOne({ _id: userId }, { $set: updates })
    return res.json({ ok: true, ...updates })
  } catch (error) {
    console.error('Profile update error:', error)
    return res.status(500).json({ error: "Failed to update profile" })
  }
})


router.get("/profile", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    let user = await User.findById(req.user!.id)
    if (!user) return res.status(404).json({ error: "User not found" })

    // Lazy generation for existing users missing these fields
    if (!user.username || !user.referralCode) {
      const randomId = Math.random().toString(36).substring(2, 7).toUpperCase();
      if (!user.username) user.username = `Trader_${randomId}`;
      if (!user.referralCode) user.referralCode = `VIRCEX-${randomId}`;
      await user.save();
    }

    // Get all spot positions (including USDT/USDC)
    const [positions, futuresAccs, futuresPositions] = await Promise.all([
      SpotPosition.find({ userId: String(user._id) }).lean(),
      FuturesAccount.find({ userId: String(user._id) }).lean(),
      FuturesPosition.find({ userId: String(user._id) }).lean()
    ])

    // Find USDT and USDC positions specifically
    const usdtPosition = positions.find(p => p.asset === 'USDT')
    const usdcPosition = positions.find(p => p.asset === 'USDC')

    const usdtFutures = futuresAccs.find(p => p.asset === 'USDT')
    const usdcFutures = futuresAccs.find(p => p.asset === 'USDC')

    // Get address group if exists
    let addressGroup = null
    if (user.addressGroupId) {
      addressGroup = await AddressGroup.findById(user.addressGroupId).lean()
    }

    // Calculate Portfolio USD Value and real-time PNL
    const [totalPortfolioUSD, spotEquity, futuresPnl] = await Promise.all([
      calculateTotalPortfolioUSD(String(user._id)),
      calculateSpotEquity(String(user._id)),
      futuresPnlService.calculateRealTimePNL(String(user._id))
    ])

    return res.json({
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        referralCode: user.referralCode,
        profilePicture: user.profilePicture,
        addressGroupId: user.addressGroupId,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      },
      balances: {
        totalPortfolioUSD: Math.round(totalPortfolioUSD * 100) / 100,
        spotEquity,
        futuresEquity: futuresPnl.equity,
        pnl24h: futuresPnl.pnl,
        roi24h: futuresPnl.roi,
        spotAvailableUSDT: usdtPosition?.available?.toString() ?? '0',
        spotReservedUSDT: usdtPosition?.reserved?.toString() ?? '0',
        spotAvailableUSDC: usdcPosition?.available?.toString() ?? '0',
        spotReservedUSDC: usdcPosition?.reserved?.toString() ?? '0',
        futuresAvailableUSDT: usdtFutures?.available?.toString() ?? '0',
        futuresReservedUSDT: usdtFutures?.reserved?.toString() ?? '0',
        futuresAvailableUSDC: usdcFutures?.available?.toString() ?? '0',
        futuresReservedUSDC: usdcFutures?.reserved?.toString() ?? '0',
        positions: positions.map(p => ({
          asset: p.asset,
          available: p.available?.toString() ?? '0',
          reserved: p.reserved?.toString() ?? '0'
        })),
        futuresPositions
      },
      addressGroup
    })
  } catch (error) {
    return res.status(500).json({ error: "Failed to get user profile" })
  }
})

router.get("/search", requireAuth, discoveryLimiter, async (req: AuthRequest, res: Response) => {
  const { q } = req.query
  if (!q || typeof q !== 'string') return res.json({ users: [] })

  try {
    const users = await User.find({
      $or: [
        { username: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } }
      ]
    })
      .select('username profilePicture')
      .limit(10)
      .lean()

    return res.json({ users })
  } catch (error) {
    return res.status(500).json({ error: "Search failed" })
  }
})

router.get("/insight/:username", requireAuth, async (req: AuthRequest, res: Response) => {
  const { username } = req.params

  try {
    const user = await User.findOne({ username }).lean()
    if (!user) return res.status(404).json({ error: "User not found" })

    const userId = String(user._id)

    // Parallel fetch of all public-facing data
    const [
      spotPositions,
      futuresAccs,
      futuresPositions,
      totalPortfolioUSD,
      spotEquity,
      futuresPnl
    ] = await Promise.all([
      SpotPosition.find({ userId }).lean(),
      FuturesAccount.find({ userId }).lean(),
      FuturesPosition.find({ userId }).lean(),
      calculateTotalPortfolioUSD(userId),
      calculateSpotEquity(userId),
      futuresPnlService.calculateRealTimePNL(userId)
    ])

    // Get Trade History (Futures)
    const history = await FuturesPositionHistory.find({ userId }).sort({ closedAt: -1 }).limit(50).lean()

    return res.json({
      user: {
        username: user.username,
        profilePicture: user.profilePicture,
        referralCode: user.referralCode,
        createdAt: user.createdAt
      },
      balances: {
        totalPortfolioUSD: Math.round(totalPortfolioUSD * 100) / 100,
        spotEquity,
        futuresEquity: futuresPnl.equity,
        pnl24h: futuresPnl.pnl,
        roi24h: futuresPnl.roi,
        spot: spotPositions.map((p: any) => ({
          asset: p.asset,
          available: p.available?.toString() ?? '0',
          reserved: p.reserved?.toString() ?? '0'
        })),
        futures: futuresAccs.map((a: any) => ({
          asset: a.asset,
          available: a.available?.toString() ?? '0',
          reserved: a.reserved?.toString() ?? '0'
        }))
      },
      activePositions: futuresPositions,
      history
    })
  } catch (error) {
    console.error('Insight error:', error)
    return res.status(500).json({ error: "Failed to load user insights" })
  }
})

router.get("/futures-pnl/:username", requireAuth, async (req: AuthRequest, res: Response) => {
  const { username } = req.params
  try {
    const user = await User.findOne({ username }).lean()
    if (!user) return res.status(404).json({ error: "User not found" })

    const history = await futuresPnlService.getHistoricalPNL(String(user._id), 180)
    return res.json({
      history: history.map((h: any) => ({
        date: h.date,
        pnl: h.pnlAmount,
        roi: h.roi,
        equity: h.futuresEquity
      }))
    })
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch PNL history" })
  }
})

router.get("/address-group", requireAuth, async (req: AuthRequest, res: Response) => {
  const user = await User.findById(req.user!.id).lean();
  if (!user) return res.status(404).json({ error: "User not found" });
  if (!user.addressGroupId) return res.status(404).json({ error: "No address group assigned" });
  const group = await AddressGroup.findById(user.addressGroupId).lean();
  if (!group) return res.status(404).json({ error: "Group not found" });
  return res.json({
    ethAddress: group.ethAddress ?? null,
    tronAddress: group.tronAddress ?? null,
    bscAddress: group.bscAddress ?? null,
    solAddress: group.solAddress ?? null,
    xrpAddress: group.xrpAddress ?? null,
  });
});

router.post('/transfer', requireAuth, financeLimiter, async (req: AuthRequest, res: Response) => {
  const { asset, from, to, amount } = req.body || {}
  if (!['USDT', 'USDC'].includes(asset)) return res.status(400).json({ error: 'Invalid asset' })
  if (!['spot', 'futures'].includes(from) || !['spot', 'futures'].includes(to) || from === to) return res.status(400).json({ error: 'Invalid direction' })

  const amtNum = parseFloat(amount)
  if (isNaN(amtNum) || amtNum <= 0) return res.status(400).json({ error: 'Invalid amount' })

  const session = await mongoose.startSession()
  try {
    const userId = req.user!.id
    await session.withTransaction(async () => {
      if (from === 'spot') {
        await moveMoney(session, userId, asset, amtNum, 'SPEND')
        await FuturesAccount.updateOne(
          { userId, asset },
          { $inc: { available: amtNum }, updatedAt: new Date() },
          { session, upsert: true }
        )
      } else {
        const futAcc = await FuturesAccount.findOne({ userId, asset }).session(session)
        if (!futAcc || futAcc.available < amtNum) throw new Error('Insufficient futures balance')
        futAcc.available -= amtNum
        await futAcc.save({ session })
        await moveMoney(session, userId, asset, amtNum, 'RECEIVE')
      }

      // Log Futures Activity for PNL accuracy
      await FuturesActivity.create([{
        userId,
        type: from === 'spot' ? 'TRANSFER_IN' : 'TRANSFER_OUT',
        asset,
        amount: amtNum
      }], { session })
    })

      // Sync UI
      ; (async () => {
        try {
          await syncStableBalances(userId)
          await syncFuturesBalances(userId)
        } catch { }
      })()

    return res.json({ ok: true })
  } catch (e: any) {
    console.error(`[Transfer Error] User: ${req.user?.id}`, {
      asset, from, to, amount,
      msg: e.message,
      stack: e.stack
    });
    return res.status(500).json({ error: e.message || 'Transfer failed' })
  } finally {
    await session.endSession()
  }
})

router.post('/withdraw', requireAuth, financeLimiter, async (req: AuthRequest, res: Response) => {
  const { asset, amount, address, network } = req.body || {}

  // Basic Validation
  if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) return res.status(400).json({ error: 'Invalid amount' })
  if (!address || typeof address !== 'string' || address.length < 10) return res.status(400).json({ error: 'Invalid address' })
  if (!asset) return res.status(400).json({ error: 'Missing asset' })

  // Fee Calculation (Matching Frontend 10x reduction)
  let fee = 0
  switch (asset) {
    case 'USDT': fee = 0.1; break;
    case 'USDC': fee = 0.1; break;
    case 'BTC': fee = 0.00005; break;
    case 'ETH': fee = 0.0005; break;
    case 'SOL': fee = 0.001; break;
    default: fee = 0;
  }

  const amtNum = parseFloat(amount)
  if (amtNum <= fee) return res.status(400).json({ error: 'Amount must be greater than fee' })

  const session = await mongoose.startSession()
  try {
    const userId = req.user!.id
    await session.withTransaction(async () => {
      // Logic: moveMoney SPEND attempts to deduct from Spot position.
      await moveMoney(session, userId, asset, amtNum, 'SPEND')

      // Create Withdrawal Record
      await Withdrawal.create([{
        userId,
        asset,
        network,
        address,
        amount: amtNum,
        fee,
        status: 'pending' // Simulated
      }], { session })
    })

    // Update Clients
    await syncStableBalances(userId)

    return res.json({ ok: true, message: 'Withdrawal submitted' })
  } catch (e: any) {
    console.error('Withdrawal error:', e)
    return res.status(400).json({ error: e.message || 'Withdrawal failed' })
  } finally {
    await session.endSession()
  }
})

router.get('/withdrawals', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id
    const withdrawals = await Withdrawal.find({ userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean()

    return res.json({ withdrawals })
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch withdrawals" })
  }
})

export default router;
