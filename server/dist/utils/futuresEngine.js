"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.futuresEngine = void 0;
const FuturesOrder_1 = require("../models/FuturesOrder");
const FuturesPosition_1 = require("../models/FuturesPosition");
const FuturesAccount_1 = require("../models/FuturesAccount");
const priceService_1 = require("./priceService");
const emitters_1 = require("./emitters");
const FuturesPositionHistory_1 = require("../models/FuturesPositionHistory");
const mongoose_1 = __importDefault(require("mongoose"));
class FuturesEngine {
    constructor() {
        this.interval = null;
        this.running = false;
    }
    start(ms = 2000) {
        if (this.running)
            return;
        this.running = true;
        this.interval = setInterval(() => this.tick(), ms);
        console.log('[Futures Engine] Started');
    }
    stop() {
        if (this.interval)
            clearInterval(this.interval);
        this.running = false;
    }
    async tick() {
        try {
            await this.processLimitOrders();
            await this.processTPSL();
            await this.processLiquidations();
        }
        catch (e) {
            console.error('[Futures Engine] Tick error:', e);
        }
    }
    async processLimitOrders() {
        const pendingOrders = await FuturesOrder_1.FuturesOrder.find({ status: 'pending', type: 'limit' });
        if (pendingOrders.length > 0) {
            console.log(`[Futures Engine] Checking ${pendingOrders.length} pending limit orders`);
        }
        for (const order of pendingOrders) {
            try {
                const currentPrice = await priceService_1.priceService.getPrice(order.symbol);
                const shouldFill = order.side === 'long'
                    ? currentPrice <= (order.price || 0)
                    : currentPrice >= (order.price || 0);
                console.log(`[Futures Engine] Order ${order._id} (${order.symbol} ${order.side}): Current=${currentPrice}, Limit=${order.price}, ShouldFill=${shouldFill}`);
                if (shouldFill) {
                    await this.fillOrder(order._id.toString(), currentPrice);
                }
            }
            catch (e) {
                console.error(`[Futures Engine] Error checking order ${order._id}:`, e);
            }
        }
    }
    async processTPSL() {
        const positions = await FuturesPosition_1.FuturesPosition.find({
            $or: [{ tpPrice: { $gt: 0 } }, { slPrice: { $gt: 0 } }]
        });
        for (const pos of positions) {
            try {
                const price = await priceService_1.priceService.getPrice(pos.symbol);
                if (!price)
                    continue;
                const isLong = pos.side === 'long';
                const hitTP = pos.tpPrice > 0 && (isLong ? price >= pos.tpPrice : price <= pos.tpPrice);
                const hitSL = pos.slPrice > 0 && (isLong ? price <= pos.slPrice : price >= pos.slPrice);
                if (!hitTP && !hitSL)
                    continue;
                const type = hitTP ? 'TP' : 'SL';
                const closeQty = type === 'TP' ? pos.tpQuantity : pos.slQuantity;
                if (type === 'TP') {
                    pos.tpPrice = 0;
                    pos.tpQuantity = 0;
                }
                else {
                    pos.slPrice = 0;
                    pos.slQuantity = 0;
                }
                await pos.save();
                await this.executePositionClose(pos._id.toString(), price, closeQty || undefined);
            }
            catch (e) {
                console.error(`[TP/SL] Error processing ${pos._id}:`, e);
            }
        }
    }
    async processLiquidations() {
        const positions = await FuturesPosition_1.FuturesPosition.find({});
        for (const pos of positions) {
            try {
                const currentPrice = await priceService_1.priceService.getPrice(pos.symbol);
                const diff = pos.side === 'long'
                    ? (currentPrice - pos.entryPrice)
                    : (pos.entryPrice - currentPrice);
                const unrealizedPnL = pos.quantity * diff;
                const equity = pos.margin + unrealizedPnL;
                if (equity / pos.margin <= 0) {
                    await this.liquidatePosition(pos._id.toString(), currentPrice);
                }
            }
            catch {
                // Price not ready
            }
        }
    }
    async fillOrder(orderId, fillPrice) {
        console.log(`[Futures Engine] Attempting to fill order: ${orderId} at ${fillPrice}`);
        const session = await mongoose_1.default.startSession();
        try {
            await session.withTransaction(async () => {
                const order = await FuturesOrder_1.FuturesOrder.findById(orderId).session(session);
                if (!order || order.status !== 'pending') {
                    console.warn(`[Futures Engine] Order ${orderId} not found or not pending`);
                    return;
                }
                order.status = 'filled';
                order.averagePrice = fillPrice;
                await order.save({ session });
                const quote = order.symbol.endsWith('USDT') ? 'USDT' : order.symbol.endsWith('USDC') ? 'USDC' : 'USDT';
                const marginUsed = order.margin || (order.quantity * (order.price || fillPrice)) / order.leverage;
                await FuturesAccount_1.FuturesAccount.updateOne({ userId: order.userId, asset: quote }, { $inc: { reserved: -marginUsed }, updatedAt: new Date() }, { session });
                let position = await FuturesPosition_1.FuturesPosition.findOne({ userId: order.userId, symbol: order.symbol }).session(session);
                if (position) {
                    if (position.side === order.side) {
                        // Same side: Weighted average
                        const oldTotalValue = position.quantity * position.entryPrice;
                        const newBatchValue = order.quantity * fillPrice;
                        position.quantity += order.quantity;
                        position.margin += marginUsed;
                        position.entryPrice = (oldTotalValue + newBatchValue) / position.quantity;
                        position.liquidationPrice = position.side === 'long'
                            ? position.entryPrice - (0.9 * position.margin / position.quantity)
                            : position.entryPrice + (0.9 * position.margin / position.quantity);
                        position.updatedAt = new Date();
                        await position.save({ session });
                    }
                    else {
                        // Opposite side: Reduce
                        if (order.quantity >= position.quantity) {
                            const remainingQty = order.quantity - position.quantity;
                            const pnl = position.side === 'long'
                                ? (fillPrice - position.entryPrice) * position.quantity
                                : (position.entryPrice - fillPrice) * position.quantity;
                            const marginToRelease = position.margin;
                            const futAcc = await FuturesAccount_1.FuturesAccount.findOne({ userId: order.userId, asset: quote }).session(session);
                            if (futAcc) {
                                futAcc.available += (marginToRelease + pnl);
                                await futAcc.save({ session });
                            }
                            await FuturesPositionHistory_1.FuturesPositionHistory.create([{
                                    userId: order.userId, symbol: order.symbol, side: position.side,
                                    entryPrice: position.entryPrice, exitPrice: fillPrice,
                                    quantity: position.quantity, margin: position.margin,
                                    realizedPnL: pnl, closedAt: new Date()
                                }], { session });
                            await position.deleteOne({ session });
                            if (remainingQty > 0.00000001) {
                                const remainingMargin = (remainingQty / order.quantity) * marginUsed;
                                const liqPrice = order.side === 'long'
                                    ? fillPrice - (0.9 * remainingMargin / remainingQty)
                                    : fillPrice + (0.9 * remainingMargin / remainingQty);
                                await FuturesPosition_1.FuturesPosition.create([{
                                        userId: order.userId, symbol: order.symbol, side: order.side,
                                        entryPrice: fillPrice, quantity: remainingQty,
                                        leverage: order.leverage, margin: remainingMargin,
                                        liquidationPrice: liqPrice
                                    }], { session });
                            }
                        }
                        else {
                            // Partially reduce
                            const pnl = position.side === 'long'
                                ? (fillPrice - position.entryPrice) * order.quantity
                                : (position.entryPrice - fillPrice) * order.quantity;
                            const marginToRelease = (order.quantity / position.quantity) * position.margin;
                            position.quantity -= order.quantity;
                            position.margin -= marginToRelease;
                            position.liquidationPrice = position.side === 'long'
                                ? position.entryPrice - (0.9 * position.margin / position.quantity)
                                : position.entryPrice + (0.9 * position.margin / position.quantity);
                            position.updatedAt = new Date();
                            await position.save({ session });
                            const futAcc = await FuturesAccount_1.FuturesAccount.findOne({ userId: order.userId, asset: quote }).session(session);
                            if (futAcc) {
                                futAcc.available += (marginToRelease + pnl);
                                await futAcc.save({ session });
                            }
                            await FuturesPositionHistory_1.FuturesPositionHistory.create([{
                                    userId: order.userId, symbol: order.symbol, side: position.side,
                                    entryPrice: position.entryPrice, exitPrice: fillPrice,
                                    quantity: order.quantity, margin: marginToRelease,
                                    realizedPnL: pnl, closedAt: new Date(), note: 'Partial Close'
                                }], { session });
                        }
                    }
                }
                else {
                    const liqPrice = order.side === 'long'
                        ? fillPrice - (0.9 * marginUsed / order.quantity)
                        : fillPrice + (0.9 * marginUsed / order.quantity);
                    await FuturesPosition_1.FuturesPosition.create([{
                            userId: order.userId, symbol: order.symbol, side: order.side,
                            entryPrice: fillPrice, quantity: order.quantity,
                            leverage: order.leverage, margin: marginUsed,
                            liquidationPrice: liqPrice
                        }], { session });
                }
            });
            const orderDoc = await FuturesOrder_1.FuturesOrder.findById(orderId).lean();
            if (orderDoc) {
                await (0, emitters_1.syncFuturesBalances)(orderDoc.userId);
                await (0, emitters_1.syncFuturesPosition)(orderDoc.userId, orderDoc.symbol);
                (0, emitters_1.syncOrder)(orderDoc.userId, { id: orderDoc._id, status: 'filled' });
                console.log(`[Futures Engine] Order filled successfully: ${orderId}`);
            }
        }
        catch (e) {
            console.error(`[Futures Engine] Fill error for order ${orderId}:`, e);
        }
        finally {
            await session.endSession();
        }
    }
    async liquidatePosition(posId, liquidationPrice) {
        const session = await mongoose_1.default.startSession();
        try {
            let userId = '', symbol = '';
            await session.withTransaction(async () => {
                const pos = await FuturesPosition_1.FuturesPosition.findById(posId).session(session);
                if (!pos)
                    return;
                userId = pos.userId;
                symbol = pos.symbol;
                const diff = pos.side === 'long' ? (liquidationPrice - pos.entryPrice) : (pos.entryPrice - liquidationPrice);
                const realizedPnl = pos.quantity * diff;
                await FuturesPositionHistory_1.FuturesPositionHistory.create([{
                        userId: pos.userId,
                        symbol: pos.symbol,
                        side: pos.side,
                        entryPrice: pos.entryPrice,
                        exitPrice: liquidationPrice,
                        quantity: pos.quantity,
                        leverage: pos.leverage,
                        margin: pos.margin,
                        realizedPnL: realizedPnl,
                        closedAt: new Date(),
                        note: 'Liquidated'
                    }], { session });
                await FuturesPosition_1.FuturesPosition.deleteOne({ _id: posId }).session(session);
            });
            if (userId) {
                await (0, emitters_1.syncFuturesBalances)(userId);
                await (0, emitters_1.syncFuturesPosition)(userId, symbol);
                console.log(`[Futures Engine] LIQUIDATED: ${userId} ${symbol} @ ${liquidationPrice}`);
            }
        }
        catch (e) {
            console.error(`[Futures Engine] Liquidation error for ${posId}:`, e);
        }
        finally {
            await session.endSession();
        }
    }
    async executePositionClose(posId, exitPrice, closeQuantity) {
        const session = await mongoose_1.default.startSession();
        try {
            let userId = '', symbol = '';
            await session.withTransaction(async () => {
                const pos = await FuturesPosition_1.FuturesPosition.findById(posId).session(session);
                if (!pos)
                    return;
                userId = pos.userId;
                symbol = pos.symbol;
                const totalQty = pos.quantity;
                const closeQty = closeQuantity ? Math.min(closeQuantity, totalQty) : totalQty;
                const quote = symbol.endsWith('USDT') ? 'USDT' : symbol.endsWith('USDC') ? 'USDC' : 'USDT';
                const diff = pos.side === 'long' ? (exitPrice - pos.entryPrice) : (pos.entryPrice - exitPrice);
                const realizedPnl = closeQty * diff;
                const marginToRelease = (closeQty / totalQty) * pos.margin;
                const refund = Math.max(0, marginToRelease + realizedPnl);
                await FuturesAccount_1.FuturesAccount.updateOne({ userId, asset: quote }, { $inc: { available: refund }, updatedAt: new Date() }, { session, upsert: true });
                await FuturesPositionHistory_1.FuturesPositionHistory.create([{
                        userId, symbol, side: pos.side, entryPrice: pos.entryPrice,
                        exitPrice, quantity: closeQty, leverage: pos.leverage,
                        margin: marginToRelease, realizedPnL: realizedPnl, closedAt: new Date()
                    }], { session });
                if (closeQty >= totalQty) {
                    await FuturesPosition_1.FuturesPosition.deleteOne({ _id: posId }).session(session);
                }
                else {
                    pos.quantity -= closeQty;
                    pos.margin -= marginToRelease;
                    pos.realizedPnL = (pos.realizedPnL || 0) + realizedPnl;
                    pos.updatedAt = new Date();
                    await pos.save({ session });
                }
            });
            if (userId) {
                await (0, emitters_1.syncFuturesBalances)(userId);
                await (0, emitters_1.syncFuturesPosition)(userId, symbol);
            }
        }
        catch (e) {
            console.error(`[Futures Engine] Close error for ${posId}:`, e);
        }
        finally {
            await session.endSession();
        }
    }
}
exports.futuresEngine = new FuturesEngine();
//# sourceMappingURL=futuresEngine.js.map