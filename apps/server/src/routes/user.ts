import { Router, type Request, type Response } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { User } from "../models/User";
import { AddressGroup } from "../models/AddressGroup";

const router = Router();

router.get("/me", requireAuth, async (req: AuthRequest, res: Response) => {
  const user = await User.findById(req.user!.id).lean();
  if (!user) return res.status(404).json({ error: "User not found" });
  const group = user.addressGroupId ? await AddressGroup.findById(user.addressGroupId).lean() : null;
  return res.json({
    id: String(user._id),
    email: user.email,
    balances: user.balances,
    addressGroup: group ? {
      ethAddress: group.ethAddress ?? null,
      tronAddress: group.tronAddress ?? null,
      bscAddress: group.bscAddress ?? null,
      solAddress: group.solAddress ?? null,
      xrpAddress: group.xrpAddress ?? null,
    } : null,
  });
});

router.get("/deposit-address", requireAuth, async (req: AuthRequest, res: Response) => {
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


