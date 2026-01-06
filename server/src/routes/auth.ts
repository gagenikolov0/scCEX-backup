import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import { User } from "../models/User";
import { AddressGroup } from "../models/AddressGroup";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { authLimiter } from "../middleware/rateLimiter";

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

router.post("/register", authLimiter, async (req: Request, res: Response) => {
  const parse = registerSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: "Invalid input" });
  const { email, password } = parse.data;

  const existing = await User.findOne({ email }).lean();
  if (existing) return res.status(409).json({ error: "Email already registered" });

  const passwordHash = await bcrypt.hash(password, 12);

  // Generate random username and referral code
  const randomId = Math.random().toString(36).substring(2, 7).toUpperCase();
  const username = `Trader_${randomId}`;
  const referralCode = `VIRCEX-${randomId}`;

  // Create user first
  const user = await User.create({
    email,
    passwordHash,
    username,
    referralCode
  });

  // Assign a free deposit address if available, link to user
  const freeGroup = await AddressGroup.findOneAndUpdate(
    { assignedTo: null },
    { $set: { assignedTo: user._id } },
    { sort: { _id: 1 }, returnDocument: 'after' }
  ).lean();
  if (freeGroup) {
    await User.updateOne({ _id: user._id }, { $set: { addressGroupId: freeGroup._id } });
  }

  const access = signAccessToken({ sub: String(user._id), ver: user.refreshTokenVersion });
  const refresh = signRefreshToken({ sub: String(user._id), ver: user.refreshTokenVersion });

  const isProd = process.env.NODE_ENV === "production";
  res
    .cookie("refresh_token", refresh, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
    .status(201)
    .json({ accessToken: access, user: { id: user._id, email: user.email } });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

router.post("/login", authLimiter, async (req: Request, res: Response) => {
  const parse = loginSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: "Invalid input" });
  const { email, password } = parse.data;

  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ error: "Invalid credentials" });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const access = signAccessToken({ sub: String(user._id), ver: user.refreshTokenVersion });
  const refresh = signRefreshToken({ sub: String(user._id), ver: user.refreshTokenVersion });
  const isProd = process.env.NODE_ENV === "production";
  res
    .cookie("refresh_token", refresh, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
    .json({ accessToken: access, user: { id: user._id, email: user.email } });
});

router.post("/logout", async (_req: Request, res: Response) => {
  res.clearCookie("refresh_token").json({ ok: true });
});

router.post("/refresh", async (req: Request, res: Response) => {
  const token = req.cookies?.["refresh_token"] as string | undefined;
  if (!token) return res.status(401).json({ error: "Missing refresh" });
  try {
    const payload = verifyRefreshToken(token);
    const user = await User.findById(payload.sub).lean();
    if (!user) return res.status(401).json({ error: "Invalid refresh" });
    if (user.refreshTokenVersion !== payload.ver)
      return res.status(401).json({ error: "Rotated refresh" });

    const access = signAccessToken({ sub: String(user._id), ver: user.refreshTokenVersion });
    const refresh = signRefreshToken({ sub: String(user._id), ver: user.refreshTokenVersion });
    const isProd = process.env.NODE_ENV === "production";
    res
      .cookie("refresh_token", refresh, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? "none" : "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
      .json({ accessToken: access });
  } catch (_e) {
    return res.status(401).json({ error: "Invalid refresh" });
  }
});

const changePasswordSchema = z.object({
  oldPassword: z.string(),
  newPassword: z.string().min(8).max(128),
});

router.post("/change-password", requireAuth, authLimiter, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const parse = changePasswordSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: "Invalid input" });
  const { oldPassword, newPassword } = parse.data;

  const user = await User.findById(authReq.user!.id);
  if (!user) return res.status(404).json({ error: "User not found" });

  const ok = await bcrypt.compare(oldPassword, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid old password" });

  const passwordHash = await bcrypt.hash(newPassword, 12);
  user.passwordHash = passwordHash;
  user.refreshTokenVersion = (user.refreshTokenVersion || 0) + 1;
  await user.save();

  res.json({ ok: true });
});

export default router;


