import { FuturesOrder } from '../models/FuturesOrder';
import { FuturesPosition } from '../models/FuturesPosition';
import { FuturesAccount } from '../models/FuturesAccount';
import { priceService } from './priceService';
import { syncFuturesBalances, syncFuturesPosition, syncOrder } from './emitters';
import { FuturesPositionHistory } from '../models/FuturesPositionHistory';
import mongoose from 'mongoose';

class FuturesEngine {
    private interval: NodeJS.Timeout | null = null;
    private running = false;

    start(ms = 2000) {
        if (this.running) return;
        this.running = true;
        this.interval = setInterval(() => this.tick(), ms);
        console.log('[Futures Engine] Started');
    }

    stop() {
        if (this.interval) clearInterval(this.interval);
        this.running = false;
    }

    private async tick() {
        try {
            await this.processLimitOrders();
            await this.processTPSL();
            await this.processLiquidations();
        } catch (e) {
            console.error('[Futures Engine] Tick error:', e);
        }
    }

    private async processLimitOrders() {
        const pendingOrders = await FuturesOrder.find({ status: 'pending', type: 'limit' });
        if (pendingOrders.length > 0) {
            console.log(`[Futures Engine] Checking ${pendingOrders.length} pending limit orders`);
        }

        for (const order of pendingOrders) {
            try {
                const currentPrice = await priceService.getPrice(order.symbol);
                const shouldFill = order.side === 'long'
                    ? currentPrice <= (order.price || 0)
                    : currentPrice >= (order.price || 0);

                console.log(`[Futures Engine] Order ${order._id} (${order.symbol} ${order.side}): Current=${currentPrice}, Limit=${order.price}, ShouldFill=${shouldFill}`);

                if (shouldFill) {
                    await this.fillOrder(order._id.toString(), currentPrice);
                }
            } catch (e) {
                console.error(`[Futures Engine] Error checking order ${order._id}:`, e);
            }
        }
    }

    private async processTPSL() {
        const positions = await FuturesPosition.find({
            $or: [{ tpPrice: { $gt: 0 } }, { slPrice: { $gt: 0 } }]
        });

        for (const pos of positions) {
            try {
                const price = await priceService.getPrice(pos.symbol);
                if (!price) continue;

                const isLong = pos.side === 'long';
                const hitTP = pos.tpPrice > 0 && (isLong ? price >= pos.tpPrice : price <= pos.tpPrice);
                const hitSL = pos.slPrice > 0 && (isLong ? price <= pos.slPrice : price >= pos.slPrice);

                if (!hitTP && !hitSL) continue;

                const type = hitTP ? 'TP' : 'SL';
                const closeQty = type === 'TP' ? pos.tpQuantity : pos.slQuantity;

                if (type === 'TP') {
                    pos.tpPrice = 0;
                    pos.tpQuantity = 0;
                } else {
                    pos.slPrice = 0;
                    pos.slQuantity = 0;
                }
                await pos.save();

                await this.executePositionClose(pos._id.toString(), price, closeQty || undefined);
            } catch (e) {
                console.error(`[TP/SL] Error processing ${pos._id}:`, e);
            }
        }
    }

    private async processLiquidations() {
        const positions = await FuturesPosition.find({});
        for (const pos of positions) {
            try {
                const currentPrice = await priceService.getPrice(pos.symbol);
                const diff = pos.side === 'long'
                    ? (currentPrice - pos.entryPrice)
                    : (pos.entryPrice - currentPrice);
                const unrealizedPnL = pos.quantity * diff;

                const equity = pos.margin + unrealizedPnL;
                if (equity / pos.margin <= 0) {
                    await this.liquidatePosition(pos._id.toString(), currentPrice);
                }
            } catch {
                // Price not ready
            }
        }
    }

    private async fillOrder(orderId: string, fillPrice: number) {
        console.log(`[Futures Engine] Attempting to fill order: ${orderId} at ${fillPrice}`);
        const session = await mongoose.startSession();
        try {
            await session.withTransaction(async () => {
                const order = await FuturesOrder.findById(orderId).session(session);
                if (!order || order.status !== 'pending') {
                    console.warn(`[Futures Engine] Order ${orderId} not found or not pending`);
                    return;
                }

                order.status = 'filled';
                order.averagePrice = fillPrice;
                await order.save({ session });

                const quote = order.symbol.endsWith('USDT') ? 'USDT' : order.symbol.endsWith('USDC') ? 'USDC' : 'USDT';
                const marginUsed = order.margin || (order.quantity * (order.price || fillPrice)) / order.leverage;

                await FuturesAccount.updateOne(
                    { userId: order.userId, asset: quote },
                    { $inc: { reserved: -marginUsed }, updatedAt: new Date() },
                    { session }
                );

                let position = await FuturesPosition.findOne({ userId: order.userId, symbol: order.symbol }).session(session);
                if (position) {
                    if (position.side === order.side) {
                        // Same side: Weighted average
                        const oldTotalValue = position.quantity * position.entryPrice;
                        const newBatchValue = order.quantity * fillPrice;

                        position.quantity += order.quantity;
                        position.margin += marginUsed;
                        const newEntryPrice = (oldTotalValue + newBatchValue) / position.quantity;
                        position.entryPrice = isNaN(newEntryPrice) ? fillPrice : newEntryPrice;
                        if (isNaN(newEntryPrice)) console.error('CRITICAL: Engine entryPrice NaN, fixed.');

                        position.liquidationPrice = position.side === 'long'
                            ? position.entryPrice - (0.9 * position.margin / position.quantity)
                            : position.entryPrice + (0.9 * position.margin / position.quantity);

                        position.updatedAt = new Date();
                        await position.save({ session });
                    } else {
                        // Opposite side: Not allowed - cancel the order
                        order.status = 'cancelled';
                        await order.save({ session });

                        // Refund the margin
                        await FuturesAccount.updateOne(
                            { userId: order.userId, asset: quote },
                            { $inc: { reserved: -marginUsed, available: marginUsed }, updatedAt: new Date() },
                            { session }
                        );

                        console.warn(`[Futures Engine] Order ${orderId} cancelled: opposite side position exists`);
                        return;
                    }
                } else {
                    const liqPrice = order.side === 'long'
                        ? fillPrice - (0.9 * marginUsed / order.quantity)
                        : fillPrice + (0.9 * marginUsed / order.quantity);

                    await FuturesPosition.create([{
                        userId: order.userId, symbol: order.symbol, side: order.side,
                        entryPrice: fillPrice, quantity: order.quantity,
                        leverage: order.leverage, margin: marginUsed,
                        liquidationPrice: liqPrice
                    }], { session });
                }
            });

            const orderDoc = await FuturesOrder.findById(orderId).lean();
            if (orderDoc) {
                await syncFuturesBalances(orderDoc.userId);
                await syncFuturesPosition(orderDoc.userId, orderDoc.symbol);
                syncOrder(orderDoc.userId, { id: orderDoc._id, status: 'filled' });
                console.log(`[Futures Engine] Order filled successfully: ${orderId}`);
            }
        } catch (e) {
            console.error(`[Futures Engine] Fill error for order ${orderId}:`, e);
        } finally {
            await session.endSession();
        }
    }

    private async liquidatePosition(posId: string, liquidationPrice: number) {
        const session = await mongoose.startSession();
        try {
            let userId = '', symbol = '';
            await session.withTransaction(async () => {
                const pos = await FuturesPosition.findById(posId).session(session);
                if (!pos) return;

                userId = pos.userId;
                symbol = pos.symbol;

                const diff = pos.side === 'long' ? (liquidationPrice - pos.entryPrice) : (pos.entryPrice - liquidationPrice);
                const realizedPnl = pos.quantity * diff;

                await FuturesPositionHistory.create([{
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

                await FuturesPosition.deleteOne({ _id: posId }).session(session);
            });

            if (userId) {
                await syncFuturesBalances(userId);
                await syncFuturesPosition(userId, symbol);
                console.log(`[Futures Engine] LIQUIDATED: ${userId} ${symbol} @ ${liquidationPrice}`);
            }
        } catch (e) {
            console.error(`[Futures Engine] Liquidation error for ${posId}:`, e);
        } finally {
            await session.endSession();
        }
    }

    public async executePositionClose(posId: string, exitPrice: number, closeQuantity?: number) {
        const session = await mongoose.startSession();
        try {
            let userId = '', symbol = '';
            await session.withTransaction(async () => {
                const pos = await FuturesPosition.findById(posId).session(session);
                if (!pos) return;

                userId = pos.userId;
                symbol = pos.symbol;

                const totalQty = pos.quantity;
                const closeQty = closeQuantity ? Math.min(closeQuantity, totalQty) : totalQty;
                const quote = symbol.endsWith('USDT') ? 'USDT' : symbol.endsWith('USDC') ? 'USDC' : 'USDT';

                const diff = pos.side === 'long' ? (exitPrice - pos.entryPrice) : (pos.entryPrice - exitPrice);
                const realizedPnl = closeQty * diff;

                const marginToRelease = (closeQty / totalQty) * pos.margin;
                const refund = Math.max(0, marginToRelease + realizedPnl);

                await FuturesAccount.updateOne(
                    { userId, asset: quote },
                    { $inc: { available: refund }, updatedAt: new Date() },
                    { session, upsert: true }
                );

                await FuturesPositionHistory.create([{
                    userId, symbol, side: pos.side, entryPrice: pos.entryPrice,
                    exitPrice, quantity: closeQty, leverage: pos.leverage,
                    margin: marginToRelease, realizedPnL: realizedPnl, closedAt: new Date()
                }], { session });

                if (closeQty >= totalQty) {
                    await FuturesPosition.deleteOne({ _id: posId }).session(session);
                } else {
                    pos.quantity -= closeQty;
                    pos.margin -= marginToRelease;
                    pos.realizedPnL = (pos.realizedPnL || 0) + realizedPnl;
                    pos.updatedAt = new Date();
                    await pos.save({ session });
                }
            });

            if (userId) {
                await syncFuturesBalances(userId);
                await syncFuturesPosition(userId, symbol);
            }
        } catch (e) {
            console.error(`[Futures Engine] Close error for ${posId}:`, e);
        } finally {
            await session.endSession();
        }
    }
}

export const futuresEngine = new FuturesEngine();
