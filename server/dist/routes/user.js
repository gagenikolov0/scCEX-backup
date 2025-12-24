"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const User_1 = require("../models/User");
const SpotPosition_1 = __importDefault(require("../models/SpotPosition"));
const FuturesAccount_1 = require("../models/FuturesAccount");
const FuturesPosition_1 = require("../models/FuturesPosition");
const AddressGroup_1 = require("../models/AddressGroup");
const moneyMovement_1 = require("../utils/moneyMovement");
const emitters_1 = require("../utils/emitters");
const portfolio_1 = require("../utils/portfolio");
const mongoose_1 = __importDefault(require("mongoose"));
const router = (0, express_1.Router)();
router.get("/profile", auth_1.requireAuth, async (req, res) => {
    try {
        const user = await User_1.User.findById(req.user.id).lean();
        if (!user)
            return res.status(404).json({ error: "User not found" });
        // Get all spot positions (including USDT/USDC)
        const [positions, futuresAccs, futuresPositions] = await Promise.all([
            SpotPosition_1.default.find({ userId: String(user._id) }).lean(),
            FuturesAccount_1.FuturesAccount.find({ userId: String(user._id) }).lean(),
            FuturesPosition_1.FuturesPosition.find({ userId: String(user._id) }).lean()
        ]);
        // Find USDT and USDC positions specifically
        const usdtPosition = positions.find(p => p.asset === 'USDT');
        const usdcPosition = positions.find(p => p.asset === 'USDC');
        const usdtFutures = futuresAccs.find(p => p.asset === 'USDT');
        const usdcFutures = futuresAccs.find(p => p.asset === 'USDC');
        // Get address group if exists
        let addressGroup = null;
        if (user.addressGroupId) {
            addressGroup = await AddressGroup_1.AddressGroup.findById(user.addressGroupId).lean();
        }
        // Calculate Portfolio USD Value
        const totalPortfolioUSD = await (0, portfolio_1.calculateTotalPortfolioUSD)(String(user._id));
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
        });
    }
    catch (error) {
        return res.status(500).json({ error: "Failed to get user profile" });
    }
});
router.get("/address-group", auth_1.requireAuth, async (req, res) => {
    const user = await User_1.User.findById(req.user.id).lean();
    if (!user)
        return res.status(404).json({ error: "User not found" });
    if (!user.addressGroupId)
        return res.status(404).json({ error: "No address group assigned" });
    const group = await AddressGroup_1.AddressGroup.findById(user.addressGroupId).lean();
    if (!group)
        return res.status(404).json({ error: "Group not found" });
    return res.json({
        ethAddress: group.ethAddress ?? null, //❓why null?
        tronAddress: group.tronAddress ?? null,
        bscAddress: group.bscAddress ?? null,
        solAddress: group.solAddress ?? null,
        xrpAddress: group.xrpAddress ?? null,
    });
});
router.post('/transfer', auth_1.requireAuth, async (req, res) => {
    const { asset, from, to, amount } = req.body || {};
    if (!['USDT', 'USDC'].includes(asset))
        return res.status(400).json({ error: 'Invalid asset' });
    if (!['spot', 'futures'].includes(from) || !['spot', 'futures'].includes(to) || from === to)
        return res.status(400).json({ error: 'Invalid direction' });
    const amtNum = parseFloat(amount);
    if (isNaN(amtNum) || amtNum <= 0)
        return res.status(400).json({ error: 'Invalid amount' });
    const session = await mongoose_1.default.startSession();
    try {
        const userId = req.user.id;
        await session.withTransaction(async () => {
            if (from === 'spot') {
                await (0, moneyMovement_1.moveMoney)(session, userId, asset, amtNum, 'SPEND');
                await FuturesAccount_1.FuturesAccount.updateOne({ userId, asset }, { $inc: { available: amtNum }, updatedAt: new Date() }, { session, upsert: true });
            }
            else {
                const futAcc = await FuturesAccount_1.FuturesAccount.findOne({ userId, asset }).session(session);
                if (!futAcc || futAcc.available < amtNum)
                    throw new Error('Insufficient futures balance');
                futAcc.available -= amtNum;
                await futAcc.save({ session });
                await (0, moneyMovement_1.moveMoney)(session, userId, asset, amtNum, 'RECEIVE');
            }
        });
        (async () => {
            try {
                await (0, emitters_1.syncStableBalances)(userId);
                await (0, emitters_1.syncFuturesBalances)(userId);
            }
            catch { }
        })();
        return res.json({ ok: true });
    }
    catch (e) {
        console.error('Transfer error:', e);
        return res.status(500).json({ error: e.message || 'Transfer failed', stack: e.stack, details: JSON.stringify(e) });
    }
    finally {
        await session.endSession();
    }
});
exports.default = router;
//# sourceMappingURL=user.js.map