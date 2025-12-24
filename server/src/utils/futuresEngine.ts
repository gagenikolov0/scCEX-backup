import { FuturesOrder } from '../models/FuturesOrder';
import { FuturesPosition } from '../models/FuturesPosition';
import { FuturesAccount } from '../models/FuturesAccount';
import { priceService } from './priceService';
import { syncFuturesBalances, syncFuturesPosition, syncOrder } from './emitters';
import { FuturesPositionHistory } from '../models/FuturesPositionHistory';
import mongoose from 'mongoose';

/**
 * The "Pro Engine" - Handles background tasks for Futures:
 * 1. Matching: Fills pending limit orders if price reached.
 * 2. Liquidation: Closes positions if margin is wiped out.
 */
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
            //Executes both tasks in one go
            await this.processLimitOrders(); // Checks limit orders
            await this.processTPSL(); // Checks Take-Profit and Stop-Loss
            await this.processLiquidations(); // Checks bankrupt positions
        } catch (e) {
            console.error('[Futures Engine] Tick error:', e);
        }
    }

    private async processLimitOrders() {
        const pendingOrders = await FuturesOrder.find({ status: 'pending', type: 'limit' });
        for (const order of pendingOrders) {
            try {
                const currentPrice = await priceService.getPrice(order.symbol);
                const shouldFill = order.side === 'long'
                    ? currentPrice <= (order.price || 0)
                    : currentPrice >= (order.price || 0);

                if (shouldFill) {
                    await this.fillOrder(order._id.toString(), currentPrice);
                }
            } catch {
                // Price not ready for this symbol
            }
        }
    }

    //When an order is "Pending", the money is locked in 'reserved'. Once it fills and becomes a Position, we MUST pull that money out of 'reserved'.
    private async fillOrder(orderId: string, fillPrice: number) {
        const session = await mongoose.startSession();
        try {
            await session.withTransaction(async () => {
                // 1. FETCH: Get the order from DB using the session for ACID safety
                const order = await FuturesOrder.findById(orderId).session(session);
                if (!order || order.status !== 'pending') return;

                // 2. STATUS UPDATE: Mark the order as filled and set its final execution price
                order.status = 'filled';
                order.averagePrice = fillPrice;
                await order.save({ session });

                // 3. UNLOCK FUNDS: Use EXACT margin stored in order to clear 'reserved'
                // When pending, money is in 'reserved'. Now it's a position, so we clear that exact lock.
                const quote = order.symbol.endsWith('USDT') ? 'USDT' : order.symbol.endsWith('USDC') ? 'USDC' : 'USDT';
                const marginUsed = order.margin || (order.quantity * (order.price || fillPrice)) / order.leverage;

                await FuturesAccount.updateOne(
                    { userId: order.userId, asset: quote },
                    { $inc: { reserved: -marginUsed }, updatedAt: new Date() },
                    { session }
                );

                // 4. Check if user already has a position on this pair
                let position = await FuturesPosition.findOne({ userId: order.userId, symbol: order.symbol }).session(session);

                if (position) {
                    /**
                     * ADDING TO POSITION (Just like Spot):
                     * If you already have 1 BTC and buy 1 more, you now have 2 BTC (Size).
                     * Since you bought more, you also had to put up more collateral (Margin).
                     * We also recalculate the AVERAGE entry price so the PnL is accurate.
                     */
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
                } else {
                    // NEW POSITION: Bankruptcy at 100% margin loss
                    const liqPrice = order.side === 'long'
                        ? fillPrice - (marginUsed / order.quantity)
                        : fillPrice + (marginUsed / order.quantity);

                    await FuturesPosition.create([{
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
            const orderDoc = await FuturesOrder.findById(orderId).lean();
            if (orderDoc) {
                (async () => {
                    await syncFuturesBalances(orderDoc.userId);
                    await syncFuturesPosition(orderDoc.userId, orderDoc.symbol);
                    syncOrder(orderDoc.userId, { id: orderDoc._id, status: 'filled' });
                })();
                console.log(`[Futures Engine] Order filled: ${orderId} @ ${fillPrice}`);
            }
        } catch (e) {
            console.error(`[Futures Engine] Fill error for order ${orderId}:`, e);
        } finally {
            await session.endSession();
        }
    }

    private async processTPSL() {
        const positions = await FuturesPosition.find({
            $or: [{ tpPrice: { $gt: 0 } }, { slPrice: { $gt: 0 } }]
        });

        for (const pos of positions) {
            try {
                const currentPrice = await priceService.getPrice(pos.symbol);
                let triggered = false;
                let triggerType: 'TP' | 'SL' | null = null;

                if (pos.side === 'long') {
                    if (pos.tpPrice > 0 && currentPrice >= pos.tpPrice) {
                        triggered = true;
                        triggerType = 'TP';
                    } else if (pos.slPrice > 0 && currentPrice <= pos.slPrice) {
                        triggered = true;
                        triggerType = 'SL';
                    }
                } else {
                    if (pos.tpPrice > 0 && currentPrice <= pos.tpPrice) {
                        triggered = true;
                        triggerType = 'TP';
                    } else if (pos.slPrice > 0 && currentPrice >= pos.slPrice) {
                        triggered = true;
                        triggerType = 'SL';
                    }
                }

                if (triggered && triggerType) {
                    const closeQty = triggerType === 'TP' ? pos.tpQuantity : pos.slQuantity;

                    // Clear the trigger so it doesn't fire again
                    if (triggerType === 'TP') {
                        pos.tpPrice = 0;
                        pos.tpQuantity = 0;
                    } else {
                        pos.slPrice = 0;
                        pos.slQuantity = 0;
                    }
                    await pos.save();

                    await this.executePositionClose(pos._id.toString(), currentPrice, closeQty > 0 ? closeQty : undefined);
                }
            } catch { }
        }
    }

    /**
     * Shared logic to close a position (Manual, TP, or SL)
     * Realizes PnL, Refunds Margin, and Records History.
     */
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

                // Update Balance
                await FuturesAccount.updateOne(
                    { userId, asset: quote },
                    { $inc: { available: refund }, updatedAt: new Date() },
                    { session, upsert: true }
                );

                // History
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
                    pos.updatedAt = new Date();
                    await pos.save({ session });
                }
            });

            if (userId) {
                (async () => {
                    await syncFuturesBalances(userId);
                    await syncFuturesPosition(userId, symbol);
                })();
            }
        } catch (e) {
            console.error(`[Futures Engine] Close error for ${posId}:`, e);
        } finally {
            await session.endSession();
        }
    }

    // Runs every 2 seconds regardles of what happens, totally independent logic.
    private async processLiquidations() {
        // 1. Scan EVERY position in the database
        const positions = await FuturesPosition.find({});
        for (const pos of positions) {
            try {
                // 2. THE PULL: It "asks" for the price, doesn't wait for a stream
                const currentPrice = await priceService.getPrice(pos.symbol);
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
            } catch {
                // Price not ready
            }
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

                // Record History before deletion
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
                    note: 'Liquidated' // We should probably add this field to history if it exists, or just let PnL speak for itself.
                }], { session });

                await FuturesPosition.deleteOne({ _id: posId }).session(session);
            });

            if (userId) {
                (async () => {
                    await syncFuturesBalances(userId);
                    await syncFuturesPosition(userId, symbol);
                })();
                console.log(`[Futures Engine] LIQUIDATED: ${userId} ${symbol} @ ${liquidationPrice}`);
            }
        } catch (e) {
            console.error(`[Futures Engine] Liquidation error for ${posId}:`, e);
        } finally {
            await session.endSession();
        }
    }
}

export const futuresEngine = new FuturesEngine();
