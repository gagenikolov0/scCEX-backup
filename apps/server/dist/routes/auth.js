"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcrypt_1 = __importDefault(require("bcrypt"));
const zod_1 = require("zod");
const User_1 = require("../models/User");
const AddressGroup_1 = require("../models/AddressGroup");
const jwt_1 = require("../utils/jwt");
const router = (0, express_1.Router)();
const registerSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8).max(128),
});
router.post("/register", async (req, res) => {
    const parse = registerSchema.safeParse(req.body);
    if (!parse.success)
        return res.status(400).json({ error: "Invalid input" });
    const { email, password } = parse.data;
    const existing = await User_1.User.findOne({ email }).lean();
    if (existing)
        return res.status(409).json({ error: "Email already registered" });
    const passwordHash = await bcrypt_1.default.hash(password, 12);
    // Create user first
    const user = await User_1.User.create({ email, passwordHash });
    // Assign a free deposit address if available, link to user
    const freeGroup = await AddressGroup_1.AddressGroup.findOneAndUpdate({ assignedTo: null }, { $set: { assignedTo: user._id } }, { sort: { _id: 1 }, returnDocument: 'after' }).lean();
    if (freeGroup) {
        await User_1.User.updateOne({ _id: user._id }, { $set: { addressGroupId: freeGroup._id } });
    }
    const access = (0, jwt_1.signAccessToken)({ sub: String(user._id), ver: user.refreshTokenVersion });
    const refresh = (0, jwt_1.signRefreshToken)({ sub: String(user._id), ver: user.refreshTokenVersion });
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
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8).max(128),
});
router.post("/login", async (req, res) => {
    const parse = loginSchema.safeParse(req.body);
    if (!parse.success)
        return res.status(400).json({ error: "Invalid input" });
    const { email, password } = parse.data;
    const user = await User_1.User.findOne({ email });
    if (!user)
        return res.status(401).json({ error: "Invalid credentials" });
    const ok = await bcrypt_1.default.compare(password, user.passwordHash);
    if (!ok)
        return res.status(401).json({ error: "Invalid credentials" });
    const access = (0, jwt_1.signAccessToken)({ sub: String(user._id), ver: user.refreshTokenVersion });
    const refresh = (0, jwt_1.signRefreshToken)({ sub: String(user._id), ver: user.refreshTokenVersion });
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
router.post("/logout", async (_req, res) => {
    res.clearCookie("refresh_token").json({ ok: true });
});
router.post("/refresh", async (req, res) => {
    const token = req.cookies?.["refresh_token"];
    if (!token)
        return res.status(401).json({ error: "Missing refresh" });
    try {
        const payload = (0, jwt_1.verifyRefreshToken)(token);
        const user = await User_1.User.findById(payload.sub).lean();
        if (!user)
            return res.status(401).json({ error: "Invalid refresh" });
        if (user.refreshTokenVersion !== payload.ver)
            return res.status(401).json({ error: "Rotated refresh" });
        const access = (0, jwt_1.signAccessToken)({ sub: String(user._id), ver: user.refreshTokenVersion });
        const refresh = (0, jwt_1.signRefreshToken)({ sub: String(user._id), ver: user.refreshTokenVersion });
        const isProd = process.env.NODE_ENV === "production";
        res
            .cookie("refresh_token", refresh, {
            httpOnly: true,
            secure: isProd,
            sameSite: isProd ? "none" : "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        })
            .json({ accessToken: access });
    }
    catch (_e) {
        return res.status(401).json({ error: "Invalid refresh" });
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map