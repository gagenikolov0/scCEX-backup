import { FuturesOrder } from '../models/FuturesOrder';
import { FuturesPosition } from '../models/FuturesPosition';
import { FuturesAccount } from '../models/FuturesAccount';
import { priceService } from './priceService';
import { syncFuturesBalances, syncFuturesPosition, syncOrder } from './emitters';
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

    private async fillOrder(orderId: string, fillPrice: number) {
        const session = await mongoose.startSession();
        try {
            await session.withTransaction(async () => {
                const order = await FuturesOrder.findById(orderId).session(session);
                if (!order || order.status !== 'pending') return;

                order.status = 'filled';
                order.averagePrice = fillPrice;
                await order.save({ session });

                /**
                 * ISSUE 1 FIX: Clearing "Zombie" Reserved Balance.
                 * TRIGGER: Executes the moment a Limit Order is successfully "Matched" and filled.
                 * RATIONALE: When an order is "Pending", the money is locked in 'reserved'. 
                 * Once it fills and becomes a Position, we MUST pull that money out of 'reserved'.
                 * Otherwise, the user's wallet would stay "locked" forever.
                 */
                const quote = order.symbol.endsWith('USDT') ? 'USDT' : order.symbol.endsWith('USDC') ? 'USDC' : 'USDT';
                const marginUsed = (order.quantity * (order.price || fillPrice)) / order.leverage;

                await FuturesAccount.updateOne(
                    { userId: order.userId, asset: quote },
                    { $inc: { reserved: -marginUsed }, updatedAt: new Date() },
                    { session }
                );

                let position = await FuturesPosition.findOne({ userId: order.userId, symbol: order.symbol }).session(session);

                if (position) {
                    position.quantity += order.quantity;
                    position.margin += marginUsed;
                    position.updatedAt = new Date();
                    await position.save({ session });
                } else {
                    const liqPrice = order.side === 'long'
                        ? fillPrice - (0.9 * marginUsed / order.quantity)
                        : fillPrice + (0.9 * marginUsed / order.quantity);

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

                if (marginRatio <= 0.1) { // 90% loss of margin = Liquidated
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
