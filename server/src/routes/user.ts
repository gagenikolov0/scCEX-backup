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


router.get("/profile", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user!.id).lean()
    if (!user) return res.status(404).json({ error: "User not found" })

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
    ethAddress: group.ethAddress ?? null, //❓why null?
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
    return res.status(500).json({ error: e.message || 'Transfer failed' })
  } finally {
    await session.endSession()
  }
})

export default router;
