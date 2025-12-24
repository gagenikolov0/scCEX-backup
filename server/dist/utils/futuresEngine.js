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
        this.interval = setInterval(() => this.tick(), ms); // tick called
        console.log('[Futures Engine] Started');
    }
    stop() {
        if (this.interval)
            clearInterval(this.interval);
        this.running = false;
    }
    /**
     * Hartbeat of the engine. Calls all the Engine functions every 2 seconds.
     */
    async tick() {
        try {
            //Executes both tasks in one go
            await this.processLimitOrders(); // Checks for limit fills
            await this.processTPSL(); // 2. Check for TP/SL Triggers
            await this.processLiquidations(); // 3. Check for Bankruptcies
        }
        catch (e) {
            console.error('[Futures Engine] Tick error:', e);
        }
    }
    async processLimitOrders() {
        const pendingOrders = await FuturesOrder_1.FuturesOrder.find({ status: 'pending', type: 'limit' });
        for (const order of pendingOrders) {
            try {
                const currentPrice = await priceService_1.priceService.getPrice(order.symbol);
                const shouldFill = order.side === 'long'
                    ? currentPrice <= (order.price || 0)
                    : currentPrice >= (order.price || 0);
                if (shouldFill) {
                    await this.fillOrder(order._id.toString(), currentPrice);
                }
            }
            catch {
                // Price not ready for this symbol
            }
        }
    }
    async fillOrder(orderId, fillPrice) {
        const session = await mongoose_1.default.startSession();
        try {
            await session.withTransaction(async () => {
                // 1. FETCH: Get the order from DB using the session for ACID safety
                const order = await FuturesOrder_1.FuturesOrder.findById(orderId).session(session);
                if (!order || order.status !== 'pending')
                    return;
                // 2. STATUS UPDATE: Mark the order as filled and set its final execution price
                order.status = 'filled';
                order.averagePrice = fillPrice;
                await order.save({ session });
                const quote = order.symbol.endsWith('USDT') ? 'USDT' : order.symbol.endsWith('USDC') ? 'USDC' : 'USDT';
                const marginUsed = order.margin || (order.quantity * (order.price || fillPrice)) / order.leverage;
                // Pull that money out of 'reserved'
                await FuturesAccount_1.FuturesAccount.updateOne({ userId: order.userId, asset: quote }, { $inc: { reserved: -marginUsed }, updatedAt: new Date() }, { session });
                // Check if user already has a position on this pair
                let position = await FuturesPosition_1.FuturesPosition.findOne({ userId: order.userId, symbol: order.symbol }).session(session);
                if (position) {
                    // If you already have 1 BTC and buy 1 more, you now have 2 BTC (Size).
                    const oldTotalValue = position.quantity * position.entryPrice;
                    const newBatchValue = order.quantity * fillPrice;
                    position.quantity += order.quantity;
                    position.margin += marginUsed;
                    // Weighted Average Entry Price
                    position.entryPrice = (oldTotalValue + newBatchValue) / position.quantity;
                    // Recalculate Liquidation: More size/margin means the "Bankrupt" point moved!
                    position.liquidationPrice = position.side === 'long'
                        ? position.entryPrice - (position.margin / position.quantity)
                        : position.entryPrice + (position.margin / position.quantity);
                    position.updatedAt = new Date();
                    await position.save({ session });
                }
                else {
                    // NEW POSITION: Bankruptcy at 100% margin loss
                    const liqPrice = order.side === 'long'
                        ? fillPrice - (marginUsed / order.quantity)
                        : fillPrice + (marginUsed / order.quantity);
                    await FuturesPosition_1.FuturesPosition.create([{
                            userId: order.userId,
                            symbol: order.symbol,
                            side: order.side,
                            entryPrice: fillPrice,
                            quantity: order.quantity,
                            leverage: order.leverage,
                            margin: marginUsed,
                            liquidationPrice: liqPrice
                        }], { session });
                }
            });
            // Sync UI outside transaction
            const orderDoc = await FuturesOrder_1.FuturesOrder.findById(orderId).lean();
            if (orderDoc) {
                (async () => {
                    await (0, emitters_1.syncFuturesBalances)(orderDoc.userId);
                    await (0, emitters_1.syncFuturesPosition)(orderDoc.userId, orderDoc.symbol);
                    (0, emitters_1.syncOrder)(orderDoc.userId, { id: orderDoc._id, status: 'filled' });
                })();
                console.log(`[Futures Engine] Order filled: ${orderId} @ ${fillPrice}`);
            }
        }
        catch (e) {
            console.error(`[Futures Engine] Fill error for order ${orderId}:`, e);
        }
        finally {
            await session.endSession();
        }
    }
    async processTPSL() {
        // 1. Efficiently find only active TP/SL orders (values > 0)
        const positions = await FuturesPosition_1.FuturesPosition.find({
            $or: [{ tpPrice: { $gt: 0 } }, { slPrice: { $gt: 0 } }]
        });
        for (const pos of positions) {
            try {
                const price = await priceService_1.priceService.getPrice(pos.symbol);
                if (!price)
                    continue;
                const isLong = pos.side === 'long';
                // 2. Check Triggers (Simple logic: Long wants High Price, Short wants Low Price)
                // Note: This logic supports SL in profit (Stop Profit) or TP in loss (Limit Cut) if configured that way.
                const hitTP = pos.tpPrice > 0 && (isLong ? price >= pos.tpPrice : price <= pos.tpPrice);
                const hitSL = pos.slPrice > 0 && (isLong ? price <= pos.slPrice : price >= pos.slPrice);
                if (hitTP || hitSL) {
                    const type = hitTP ? 'TP' : 'SL';
                    const closeQty = type === 'TP' ? pos.tpQuantity : pos.slQuantity;
                    // 3. Reset Trigger to prevent loop on partial closes
                    // (If we close 50%, we don't want the remaining 50% to trigger again in the next millisecond)
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
            }
            catch (e) {
                console.error(`[TP/SL] Error processing ${pos._id}:`, e);
            }
        }
    }
    async processLiquidations() {
        // 1. Scan EVERY position in the database
        const positions = await FuturesPosition_1.FuturesPosition.find({});
        for (const pos of positions) {
            try {
                // 2. THE PULL: It "asks" for the price, doesn't wait for a stream
                const currentPrice = await priceService_1.priceService.getPrice(pos.symbol);
                const diff = pos.side === 'long'
                    ? (currentPrice - pos.entryPrice)
                    : (pos.entryPrice - currentPrice);
                const unrealizedPnL = pos.quantity * diff;
                // Liquidation Threshold: If PnL wipes out 90% of margin
                const equity = pos.margin + unrealizedPnL;
                const marginRatio = equity / pos.margin;
                if (marginRatio <= 0) { // 100% loss of margin = Liquidated
                    // 4. If they are "Bankrupt", DELETE the position
                    await this.liquidatePosition(pos._id.toString(), currentPrice);
                }
            }
            catch {
                // Price not ready
            }
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
                // Record History before deletion
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
                        note: 'Liquidated' // We should probably add this field to history if it exists, or just let PnL speak for itself.
                    }], { session });
                await FuturesPosition_1.FuturesPosition.deleteOne({ _id: posId }).session(session);
            });
            if (userId) {
                (async () => {
                    await (0, emitters_1.syncFuturesBalances)(userId);
                    await (0, emitters_1.syncFuturesPosition)(userId, symbol);
                })();
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
    /**
     * Shared logic to close a position (Manual, TP, or SL) Realizes PnL, Refunds Margin, and Records History.
     */
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
                // Update Balance
                await FuturesAccount_1.FuturesAccount.updateOne({ userId, asset: quote }, { $inc: { available: refund }, updatedAt: new Date() }, { session, upsert: true });
                // History
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
                    pos.updatedAt = new Date();
                    await pos.save({ session });
                }
            });
            if (userId) {
                (async () => {
                    await (0, emitters_1.syncFuturesBalances)(userId); // "Hey, you have more money now"
                    await (0, emitters_1.syncFuturesPosition)(userId, symbol); // "Hey, you have more positions now"
                })();
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