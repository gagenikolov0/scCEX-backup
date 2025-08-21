import { Router, type Request, type Response } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { User } from "../models/User";
import { DepositAddress } from "../models/DepositAddress";

const router = Router();

router.get("/me", requireAuth, async (req: AuthRequest, res: Response) => {
  const user = await User.findById(req.user!.id).lean();
  if (!user) return res.status(404).json({ error: "User not found" });
  let key: { address: string; asset: string; chain: string } | null = null;
  if (user.depositAddressId) {
    const k = await DepositAddress.findById(user.depositAddressId).lean();
    if (k) key = { address: k.address, asset: k.asset, chain: k.chain } as any;
  }
  return res.json({
    id: String(user._id),
    email: user.email,
    balances: user.balances,
    key,
  });
});

router.get("/deposit-address", requireAuth, async (req: AuthRequest, res: Response) => {
  const user = await User.findById(req.user!.id).lean();
  if (!user) return res.status(404).json({ error: "User not found" });
  if (!user.depositAddressId) return res.status(404).json({ error: "No deposit address assigned" });
  const k = await DepositAddress.findById(user.depositAddressId).lean();
  if (!k) return res.status(404).json({ error: "Key not found" });
  return res.json({ address: k.address, asset: k.asset, chain: k.chain });
});

export default router;


