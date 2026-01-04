import { Router, type Request, type Response } from 'express'
import { requireAuth, type AuthRequest } from '../middleware/auth'
import { User } from '../models/User'
import SpotPosition from '../models/SpotPosition'
import { FuturesAccount } from '../models/FuturesAccount'
import { FuturesPosition } from '../models/FuturesPosition'
import { AddressGroup } from '../models/AddressGroup'
import { moveMoney } from '../utils/moneyMovement'
import { syncStableBalances, syncFuturesBalances } from '../utils/emitters'
import { calculateTotalPortfolioUSD } from '../utils/portfolio'
import mongoose from "mongoose";

const router = Router();

router.patch("/profile", requireAuth, async (req: AuthRequest, res: Response) => {
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
    if (updates.username) {
      const existing = await User.findOne({ username: updates.username, _id: { $ne: userId } }).lean()
      if (existing) {
        return res.status(409).json({ error: "Username already taken" })
      }
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

    // Calculate Portfolio USD Value
    const totalPortfolioUSD = await calculateTotalPortfolioUSD(String(user._id));

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
        spotAvailableUSDT: usdtPosition?.available?.toString() ?? '0',
        spotAvailableUSDC: usdcPosition?.available?.toString() ?? '0',
        futuresAvailableUSDT: usdtFutures?.available?.toString() ?? '0',
        futuresAvailableUSDC: usdcFutures?.available?.toString() ?? '0',
        totalPortfolioUSD: Math.round(totalPortfolioUSD * 100) / 100,
        positions: positions.map(p => ({
          asset: p.asset,
          available: p.available?.toString() ?? '0'
        })),
        futuresPositions
      },
      addressGroup
    })
  } catch (error) {
    return res.status(500).json({ error: "Failed to get user profile" })
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

router.post('/transfer', requireAuth, async (req: AuthRequest, res: Response) => {
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
    console.error('Transfer error:', e);
    return res.status(500).json({ error: e.message || 'Transfer failed', stack: e.stack, details: JSON.stringify(e) })
  } finally {
    await session.endSession()
  }
})

router.post('/withdraw', requireAuth, async (req: AuthRequest, res: Response) => {
  const { asset, amount, address, network } = req.body || {}

  // Basic Validation
  if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) return res.status(400).json({ error: 'Invalid amount' })
  if (!address || typeof address !== 'string' || address.length < 10) return res.status(400).json({ error: 'Invalid address' })
  if (!asset) return res.status(400).json({ error: 'Missing asset' })

  const session = await mongoose.startSession()
  try {
    const userId = req.user!.id
    await session.withTransaction(async () => {
      // Logic: moveMoney SPEND attempts to deduct from Spot position.
      // If insufficient funds, it throws Error('Insufficient balance')
      await moveMoney(session, userId, asset, parseFloat(amount), 'SPEND')

      // TODO: Create a Withdrawal Record to track this request
      // await Withdrawal.create([...])
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

export default router;
