import { Router, type Request, type Response } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { User } from "../models/User";
import { AddressGroup } from "../models/AddressGroup";
import mongoose from "mongoose";

const router = Router();

router.get("/me", requireAuth, async (req: AuthRequest, res: Response) => {
  const user = await User.findById(req.user!.id).lean();
  if (!user) return res.status(404).json({ error: "User not found" });
  const group = user.addressGroupId ? await AddressGroup.findById(user.addressGroupId).lean() : null;
  return res.json({
    id: String(user._id),
    email: user.email,
    balances: {
      spot: {
        available: { USDT: user.spotAvailableUSDT?.toString() ?? "0", USDC: user.spotAvailableUSDC?.toString() ?? "0" },
        total: { USDT: user.spotTotalUSDT?.toString() ?? "0", USDC: user.spotTotalUSDC?.toString() ?? "0" },
      },
      futures: {
        available: { USDT: user.futuresAvailableUSDT?.toString() ?? "0", USDC: user.futuresAvailableUSDC?.toString() ?? "0" },
        total: { USDT: user.futuresTotalUSDT?.toString() ?? "0", USDC: user.futuresTotalUSDC?.toString() ?? "0" },
      },
    },
    addressGroup: group ? {
      ethAddress: group.ethAddress ?? null,
      tronAddress: group.tronAddress ?? null,
      bscAddress: group.bscAddress ?? null,
      solAddress: group.solAddress ?? null,
      xrpAddress: group.xrpAddress ?? null,
    } : null,
  });
});

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

export default router;

// Transfer between spot and futures within same quote currency
// Body: { asset: 'USDT'|'USDC', from: 'spot'|'futures', to: 'spot'|'futures', amount: string }
router.post('/transfer', requireAuth, async (req: AuthRequest, res: Response) => {
  const { asset, from, to, amount } = req.body || {}
  if (!['USDT','USDC'].includes(asset)) return res.status(400).json({ error: 'Invalid asset' })
  if (!['spot','futures'].includes(from) || !['spot','futures'].includes(to) || from === to) return res.status(400).json({ error: 'Invalid direction' })
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
    ;(user as any)[fromKeyAvail] = sub(fromAvail, decAmt)
    ;(user as any)[toKeyAvail] = add(toAvail, decAmt)
    await user.save({ session })
    await session.commitTransaction()
    return res.json({ ok: true })
  } catch (e: any) {
    try { await session.abortTransaction() } catch {}
    return res.status(500).json({ error: 'Transfer failed' })
  } finally {
    session.endSession()
  }
})


