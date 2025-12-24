"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mongoose_1 = __importDefault(require("mongoose"));
const auth_1 = require("../middleware/auth");
const FuturesOrder_1 = require("../models/FuturesOrder");
const FuturesPosition_1 = require("../models/FuturesPosition");
const FuturesAccount_1 = require("../models/FuturesAccount");
const FuturesPositionHistory_1 = require("../models/FuturesPositionHistory");
const priceService_1 = require("../utils/priceService");
const emitters_1 = require("../utils/emitters");
const futuresEngine_1 = require("../utils/futuresEngine");
const router = (0, express_1.Router)();
// Place a futures order
router.post('/orders', auth_1.requireAuth, async (req, res) => {
    const session = await mongoose_1.default.startSession();
    try {
        let orderDoc = null;
        await session.withTransaction(async () => {
            const { symbol, side, type, quantity, leverage, price } = req.body;
            const userId = req.user.id;
            const quote = symbol.endsWith('USDT') ? 'USDT' : symbol.endsWith('USDC') ? 'USDC' : null;
            if (!quote)
                throw new Error('Unsupported quote asset');
            let executionPrice = Number(price);
            if (type === 'market') {
                try {
                    executionPrice = await priceService_1.priceService.getPrice(symbol);
                }
                catch (e) {
                    throw new Error('Market price unavailable');
                }
            }
            const qtyUSDT = Number(quantity);
            const levNum = Number(leverage);
            const marginRequired = qtyUSDT / levNum;
            const futAcc = await FuturesAccount_1.FuturesAccount.findOne({ userId, asset: quote }).session(session);
            if (!futAcc || futAcc.available < marginRequired - 0.00000001) {
                throw new Error(`Insufficient ${quote} in Futures wallet`);
            }
            // Clamp subtraction to prevent scientific notation negative dust
            const finalMargin = Math.min(marginRequired, futAcc.available);
            futAcc.available -= finalMargin;
            // If balance is infinitesimally small, snap to zero
            if (futAcc.available < 0.0000000001)
                futAcc.available = 0;
            if (type === 'limit')
                futAcc.reserved += finalMargin;
            await futAcc.save({ session });
            const baseQuantity = qtyUSDT / executionPrice;
            const order = await FuturesOrder_1.FuturesOrder.create([{
                    userId, symbol, side, type,
                    quantity: baseQuantity,
                    leverage: levNum,
                    margin: finalMargin, // Store EXACT margin for reliable unreserve later
                    price: type === 'limit' ? Number(price) : executionPrice,
                    status: type === 'market' ? 'filled' : 'pending',
                    averagePrice: type === 'market' ? executionPrice : 0
                }], { session });
            orderDoc = order[0];
            if (type === 'market') {
                let position = await FuturesPosition_1.FuturesPosition.findOne({ userId, symbol }).session(session);
                if (position) {
                    position.quantity += baseQuantity;
                    position.margin += marginRequired;
                    position.updatedAt = new Date();
                    await position.save({ session });
                }
                else {
                    const liqPrice = side === 'long'
                        ? executionPrice - (0.9 * marginRequired / baseQuantity)
                        : executionPrice + (0.9 * marginRequired / baseQuantity);
                    await FuturesPosition_1.FuturesPosition.create([{
                            userId, symbol, side, entryPrice: executionPrice,
                            quantity: baseQuantity, leverage: levNum, margin: marginRequired,
                            liquidationPrice: liqPrice
                        }], { session });
                }
            }
        });
        // Sync UI
        const userId = req.user.id;
        const symbol = req.body.symbol;
        (async () => {
            try {
                await (0, emitters_1.syncFuturesBalances)(userId);
                await (0, emitters_1.syncFuturesPosition)(userId, symbol);
                if (orderDoc)
                    (0, emitters_1.syncOrder)(userId, { id: orderDoc._id, status: orderDoc.status });
            }
            catch { }
        })();
        return res.json(orderDoc);
    }
    catch (e) {
        return res.status(500).json({ error: e.message });
    }
    finally {
        await session.endSession();
    }
});
// Cancel a futures order
router.delete('/orders/:id', auth_1.requireAuth, async (req, res) => {
    const session = await mongoose_1.default.startSession();
    try {
        let canceledSymbol = '';
        await session.withTransaction(async () => {
            const userId = req.user?.id;
            const orderId = req.params.id;
            const order = await FuturesOrder_1.FuturesOrder.findOne({ _id: orderId, userId }).session(session);
            if (!order || order.status !== 'pending')
                throw new Error('Order not found or not pending');
            canceledSymbol = order.symbol;
            const quote = order.symbol.endsWith('USDT') ? 'USDT' : order.symbol.endsWith('USDC') ? 'USDC' : 'USDT';
            const futAcc = await FuturesAccount_1.FuturesAccount.findOne({ userId, asset: quote }).session(session);
            if (futAcc) {
                const marginReserved = order.margin || 0;
                futAcc.reserved = Math.max(0, futAcc.reserved - marginReserved);
                futAcc.available += marginReserved;
                await futAcc.save({ session });
            }
            order.status = 'cancelled';
            await order.save({ session });
        });
        const userId = req.user?.id;
        const orderId = req.params.id;
        (async () => {
            try {
                await (0, emitters_1.syncFuturesBalances)(userId);
                await (0, emitters_1.syncFuturesPosition)(userId, canceledSymbol);
                (0, emitters_1.syncOrder)(userId, { id: orderId, status: 'cancelled' });
            }
            catch { }
        })();
        return res.json({ success: true });
    }
    catch (e) {
        return res.status(500).json({ error: e.message });
    }
    finally {
        await session.endSession();
    }
});
// Get active positions and orders
router.get('/data', auth_1.requireAuth, async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ error: 'Unauthorized' });
        const [orders, positions] = await Promise.all([
            FuturesOrder_1.FuturesOrder.find({ userId }).sort({ createdAt: -1 }).limit(50),
            FuturesPosition_1.FuturesPosition.find({ userId })
        ]);
        return res.json({ orders, positions });
    }
    catch (e) {
        return res.status(500).json({ error: e.message });
    }
});
// Get position history
router.get('/history', auth_1.requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const history = await FuturesPositionHistory_1.FuturesPositionHistory.find({ userId }).sort({ closedAt: -1 }).limit(50);
        return res.json(history);
    }
    catch (e) {
        return res.status(500).json({ error: e.message });
    }
});
// Close a futures position
router.post('/close-position', auth_1.requireAuth, async (req, res) => {
    try {
        const userId = req.user?.id;
        const { symbol, quantity } = req.body;
        const position = await FuturesPosition_1.FuturesPosition.findOne({ userId, symbol });
        if (!position)
            throw new Error('Position not found');
        let closePrice = position.entryPrice;
        try {
            closePrice = await priceService_1.priceService.getPrice(symbol);
        }
        catch { }
        await futuresEngine_1.futuresEngine.executePositionClose(position._id.toString(), closePrice, quantity ? parseFloat(quantity) : undefined);
        return res.json({ success: true });
    }
    catch (e) {
        return res.status(500).json({ error: e.message });
    }
});
// Set TP/SL for a position
router.post('/positions/tpsl', auth_1.requireAuth, async (req, res) => {
    try {
        const userId = req.user?.id;
        const { symbol, tpPrice, slPrice, tpQuantity, slQuantity } = req.body;
        const position = await FuturesPosition_1.FuturesPosition.findOne({ userId, symbol });
        if (!position)
            return res.status(404).json({ error: 'Position not found' });
        position.tpPrice = tpPrice !== undefined ? Number(tpPrice) : position.tpPrice;
        position.tpQuantity = tpQuantity !== undefined ? Number(tpQuantity) : position.tpQuantity;
        position.slPrice = slPrice !== undefined ? Number(slPrice) : position.slPrice;
        position.slQuantity = slQuantity !== undefined ? Number(slQuantity) : position.slQuantity;
        position.updatedAt = new Date();
        await position.save();
        // Sync UI
        await (0, emitters_1.syncFuturesPosition)(userId, symbol);
        return res.json({ success: true, tpPrice: position.tpPrice, slPrice: position.slPrice });
    }
    catch (e) {
        return res.status(500).json({ error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=futures.js.map