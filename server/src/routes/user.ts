import { Router, type Request, type Response } from 'express'
import { requireAuth, type AuthRequest } from '../middleware/auth'
import { User } from '../models/User'
import SpotPosition from '../models/SpotPosition'
import { AddressGroup } from '../models/AddressGroup'
import mongoose from "mongoose";

const router = Router();

type TickerCache = { expires: number; data: any[] }
const tickerCache: TickerCache = { expires: 0, data: [] }

async function getSpotTickers(): Promise<any[]> { // ❌ Defined but never called. Dead code.
  const now = Date.now()
  if (tickerCache.expires > now && Array.isArray(tickerCache.data)) return tickerCache.data
  const upstream = await fetch("https://api.mexc.com/api/v3/ticker/price")
  const arr = upstream.ok ? await upstream.json() : []
  tickerCache.data = Array.isArray(arr) ? arr : []
  tickerCache.expires = now + 1000 // 1s TTL
  return tickerCache.data
}

router.get("/profile", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user!.id).lean()
    if (!user) return res.status(404).json({ error: "User not found" })

    // Get all spot positions (including USDT/USDC)
    const positions = await SpotPosition.find({ userId: String(user._id) }).lean()

    // Find USDT and USDC positions specifically
    const usdtPosition = positions.find(p => p.asset === 'USDT')
    const usdcPosition = positions.find(p => p.asset === 'USDC')

    // Get address group if exists
    let addressGroup = null
    if (user.addressGroupId) {
      addressGroup = await AddressGroup.findById(user.addressGroupId).lean()
    }

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
        positions: positions.map(p => ({
          asset: p.asset,
          available: p.available?.toString() ?? '0'
        }))
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
  const amt = typeof amount === 'string' ? amount : String(amount ?? '')
  if (!/^\d+(?:\.\d+)?$/.test(amt)) return res.status(400).json({ error: 'Invalid amount' })
  const session = await mongoose.startSession()
  session.startTransaction()
  try {
    const user = await User.findById(req.user!.id).session(session)
    if (!user) { await session.abortTransaction(); return res.status(404).json({ error: 'User not found' }) }
    const fromKeyAvail = `${from}Available${asset}` as keyof typeof user
    const toKeyAvail = `${to}Available${asset}` as keyof typeof user
    const decAmt = mongoose.Types.Decimal128.fromString(amt)
    const getDec = (v: any) => (v ? mongoose.Types.Decimal128.fromString(v.toString()) : mongoose.Types.Decimal128.fromString('0'))
    const fromAvail = getDec((user as any)[fromKeyAvail])
    const toAvail = getDec((user as any)[toKeyAvail])
    if (parseFloat(fromAvail.toString()) < parseFloat(decAmt.toString())) {
      await session.abortTransaction();
      return res.status(400).json({ error: 'Insufficient available balance' })
    }
    // Move available; keep totals equal to sum of available (for now)
    const sub = (a: any, b: any) => mongoose.Types.Decimal128.fromString((parseFloat(a.toString()) - parseFloat(b.toString())).toString())
    const add = (a: any, b: any) => mongoose.Types.Decimal128.fromString((parseFloat(a.toString()) + parseFloat(b.toString())).toString())
      ; (user as any)[fromKeyAvail] = sub(fromAvail, decAmt)
      ; (user as any)[toKeyAvail] = add(toAvail, decAmt)
    await user.save({ session })
    await session.commitTransaction()
    return res.json({ ok: true })
  } catch (e: any) {
    try { await session.abortTransaction() } catch { }
    return res.status(500).json({ error: 'Transfer failed' })
  } finally {
    session.endSession()
  }
})

export default router;


