"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mongoose_1 = __importDefault(require("mongoose"));
const auth_1 = require("../middleware/auth");
const SpotOrder_1 = require("../models/SpotOrder");
const SpotPosition_1 = __importDefault(require("../models/SpotPosition"));
const moneyMovement_1 = require("../utils/moneyMovement");
const priceService_1 = require("../utils/priceService");
const emitters_1 = require("../utils/emitters");
const router = (0, express_1.Router)();
// ==========================================
// 4. MAIN ROUTE
// ==========================================
router.post("/orders", auth_1.requireAuth, async (req, res) => {
    const { symbol, side, quantity, price: limitPrice, orderType = "market" } = req.body || {};
    // VALIDATION
    const sym = typeof symbol === "string" ? symbol.toUpperCase() : "";
    const sd = side === "buy" || side === "sell" ? side : null;
    const qtyStr = typeof quantity === "string" ? quantity : String(quantity ?? "");
    const isLimit = orderType === "limit";
    if (!sym || !sd)
        return res.status(400).json({ error: "Invalid input" });
    if (!/^\d+(?:\.\d+)?$/.test(qtyStr))
        return res.status(400).json({ error: "Invalid quantity" });
    if (isLimit && (!limitPrice || !/^\d+(?:\.\d+)?$/.test(limitPrice)))
        return res.status(400).json({ error: "Invalid limit price" });
    const quote = sym.endsWith("USDT") ? "USDT" : sym.endsWith("USDC") ? "USDC" : null;
    if (!quote)
        return res.status(400).json({ error: "Unsupported quote" });
    const base = sym.replace(/(USDT|USDC)$/i, ""); // Remove quote from symbol
    const session = await mongoose_1.default.startSession();
    try {
        const userId = req.user.id;
        let orderRes = null;
        await session.withTransaction(async () => {
            const currentPrice = await priceService_1.priceService.getPrice(sym);
            const qtyBase = parseFloat(qtyStr);
            const executionPrice = isLimit ? parseFloat(limitPrice) : currentPrice;
            const quoteAmount = qtyBase * executionPrice;
            console.log(`[EXECUTION] ${sym} Price: ${currentPrice} | Order: ${sd.toUpperCase()} ${qtyBase} @ ${executionPrice}`);
            let status = "filled";
            let isPending = false;
            if (isLimit) {
                const isFillable = (sd === "buy" && executionPrice >= currentPrice) ||
                    (sd === "sell" && executionPrice <= currentPrice);
                if (!isFillable) {
                    status = "pending";
                    isPending = true;
                }
            }
            if (isPending) {
                if (sd === "buy")
                    await (0, moneyMovement_1.moveMoney)(session, userId, quote, quoteAmount, 'RESERVE');
                else
                    await (0, moneyMovement_1.moveMoney)(session, userId, base, qtyBase, 'RESERVE');
            }
            else {
                if (sd === "buy") {
                    await (0, moneyMovement_1.moveMoney)(session, userId, quote, quoteAmount, 'SPEND');
                    await (0, moneyMovement_1.moveMoney)(session, userId, base, qtyBase, 'RECEIVE');
                }
                else {
                    await (0, moneyMovement_1.moveMoney)(session, userId, base, qtyBase, 'SPEND');
                    await (0, moneyMovement_1.moveMoney)(session, userId, quote, quoteAmount, 'RECEIVE');
                }
            }
            const orderDoc = await new SpotOrder_1.SpotOrder({
                userId, symbol: sym, baseAsset: base, quoteAsset: quote, side: sd,
                quantityBase: String(qtyBase), priceQuote: String(executionPrice), quoteAmount: String(quoteAmount),
                status,
            }).save({ session });
            orderRes = {
                id: orderDoc._id, symbol: sym, side: sd, quantity: String(qtyBase),
                price: String(executionPrice), quoteAmount: String(quoteAmount), status, createdAt: orderDoc.createdAt
            };
        });
        (async () => {
            try {
                await (0, emitters_1.syncStableBalances)(userId);
                await (0, emitters_1.syncPosition)(userId, base);
                (0, emitters_1.syncOrder)(userId, orderRes);
            }
            catch { }
        })();
        return res.status(201).json(orderRes);
    }
    catch (e) {
        console.error(`Order Error: ${e.message}`);
        return res.status(400).json({ error: e.message || "Order failed" });
    }
    finally {
        await session.endSession();
    }
});
// GET /api/spot/orders
router.get("/orders", auth_1.requireAuth, async (req, res) => {
    const limit = Math.min(parseInt(String(req.query?.limit ?? "50"), 10) || 50, 200);
    const rows = await SpotOrder_1.SpotOrder.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(limit).lean();
    return res.json(rows.map((r) => ({
        id: String(r._id),
        symbol: r.symbol,
        side: r.side,
        quantity: r.quantityBase ? String(r.quantityBase) : "0",
        price: r.priceQuote ? String(r.priceQuote) : "0",
        quoteAmount: r.quoteAmount ? String(r.quoteAmount) : "0",
        status: r.status,
        createdAt: r.createdAt,
    })));
});
// GET /api/spot/positions
router.get("/positions", auth_1.requireAuth, async (req, res) => {
    const rows = await SpotPosition_1.default.find({ userId: req.user.id }).lean();
    return res.json(rows.map((r) => ({
        asset: r.asset, available: r.available ?? "0", reserved: r.reserved ?? "0", updatedAt: r.updatedAt,
    })));
});
// GET /api/spot/history
router.get("/history", auth_1.requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const history = await SpotOrder_1.SpotOrder.find({ userId, status: 'filled' }).sort({ createdAt: -1 }).limit(50).lean();
        return res.json(history);
    }
    catch (e) {
        return res.status(500).json({ error: e.message });
    }
});
// DELETE /api/spot/orders/:id
router.delete("/orders/:id", auth_1.requireAuth, async (req, res) => {
    const orderId = req.params.id;
    if (!orderId)
        return res.status(400).json({ error: "ID required" });
    const session = await mongoose_1.default.startSession();
    try {
        const userId = req.user.id;
        let orderBaseAsset = '';
        let orderIdToEmit = '';
        await session.withTransaction(async () => {
            const order = await SpotOrder_1.SpotOrder.findOne({ _id: orderId, userId }).session(session);
            if (!order || order.status !== "pending")
                throw new Error("Cannot cancel");
            orderBaseAsset = order.baseAsset;
            orderIdToEmit = String(order._id);
            await SpotOrder_1.SpotOrder.updateOne({ _id: orderId }, { status: "rejected" }, { session });
            if (order.side === "buy") {
                await (0, moneyMovement_1.moveMoney)(session, userId, order.quoteAsset, parseFloat(order.quoteAmount.toString()), 'UNRESERVE');
            }
            else {
                await (0, moneyMovement_1.moveMoney)(session, userId, order.baseAsset, parseFloat(order.quantityBase.toString()), 'UNRESERVE');
            }
        });
        (async () => {
            try {
                await (0, emitters_1.syncStableBalances)(userId);
                await (0, emitters_1.syncPosition)(userId, orderBaseAsset);
                (0, emitters_1.syncOrder)(userId, { id: orderIdToEmit, status: 'rejected' });
            }
            catch { }
        })();
        return res.json({ success: true });
    }
    catch (e) {
        return res.status(500).json({ error: e.message || "Cancel failed" });
    }
    finally {
        await session.endSession();
    }
});
exports.default = router;
//# sourceMappingURL=spot.js.map