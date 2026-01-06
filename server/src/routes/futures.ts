import { Router, type Response } from 'express'
import mongoose from 'mongoose'
import { requireAuth, type AuthRequest } from '../middleware/auth'
import { FuturesOrder } from '../models/FuturesOrder'
import { FuturesPosition } from '../models/FuturesPosition'
import { FuturesAccount } from '../models/FuturesAccount'
import { FuturesPositionHistory } from '../models/FuturesPositionHistory'
import { priceService } from '../utils/priceService'
import { syncFuturesBalances, syncOrder, syncFuturesPosition } from '../utils/emitters'
import { futuresEngine } from '../utils/futuresEngine'
import { tradeLimiter } from '../middleware/rateLimiter'

const router = Router()

// Place a futures order
router.post('/orders', requireAuth, tradeLimiter, async (req: AuthRequest, res: Response) => {
    const session = await mongoose.startSession()
    try {
        let orderDoc: any = null
        await session.withTransaction(async () => {
            const { symbol, side, type, quantity, leverage, price } = (req as any).body
            const userId = req.user!.id

            const quote = symbol.endsWith('USDT') ? 'USDT' : symbol.endsWith('USDC') ? 'USDC' : null
            if (!quote) throw new Error('Unsupported quote asset')

            let executionPrice = Number(price)
            if (type === 'market') {
                try {
                    executionPrice = await priceService.getPrice(symbol)
                } catch (e) {
                    throw new Error('Market price unavailable')
                }
            }

            const qtyUSDT = Number(quantity)
            const levNum = Number(leverage)

            if (isNaN(qtyUSDT) || qtyUSDT <= 0) throw new Error('Invalid quantity')
            if (isNaN(levNum) || levNum <= 0) throw new Error('Invalid leverage')
            if (type === 'limit' && (isNaN(Number(price)) || Number(price) <= 0)) throw new Error('Invalid price for limit order')
            if (isNaN(executionPrice) || executionPrice <= 0) throw new Error('Invalid execution price')

            const marginRequired = qtyUSDT / levNum

            const futAcc = await FuturesAccount.findOne({ userId, asset: quote }).session(session)
            if (!futAcc || futAcc.available < marginRequired - 0.00000001) {
                throw new Error(`Insufficient ${quote} in Futures wallet`)
            }

            const finalMargin = Math.min(marginRequired, futAcc.available) // Clamp subtraction to prevent scientific notation negative dust

            futAcc.available -= finalMargin

            if (futAcc.available < 0.0000000001) futAcc.available = 0  // If balance is infinitesimally small, snap to zero

            if (type === 'limit') futAcc.reserved += finalMargin
            // 1. Deduct money
            await futAcc.save({ session })

            const baseQuantity = qtyUSDT / executionPrice

            // 2. Create the order record
            const order = await FuturesOrder.create([{
                userId, symbol, side, type,
                quantity: baseQuantity,
                leverage: levNum,
                margin: finalMargin, // Store EXACT margin for reliable unreserve later
                price: type === 'limit' ? Number(price) : executionPrice,
                status: type === 'market' ? 'filled' : 'pending',
                averagePrice: type === 'market' ? executionPrice : 0
            }], { session })
            orderDoc = order[0]

            if (type === 'market') {
                let position = await FuturesPosition.findOne({ userId, symbol }).session(session)
                if (position) {
                    if (position.side === side) {
                        // Same side: Weighted average entry price
                        const oldTotalValue = position.quantity * position.entryPrice
                        const newBatchValue = baseQuantity * executionPrice

                        console.log('Updating EXISTING position (Same Side):', {
                            posId: position._id,
                            currentEntry: position.entryPrice,
                            currentQty: position.quantity,
                            addQty: baseQuantity,
                            execPrice: executionPrice,
                            oldVal: oldTotalValue,
                            newVal: newBatchValue
                        });

                        if (isNaN(position.entryPrice)) console.error('CRITICAL: Existing position has NaN entryPrice!', position);

                        position.quantity += baseQuantity
                        position.margin += marginRequired
                        let newEntryPrice = (oldTotalValue + newBatchValue) / position.quantity

                        if (isNaN(newEntryPrice)) {
                            console.error('CRITICAL: New entryPrice is NaN! Fallback to executionPrice.', {
                                oldTotalValue, newBatchValue, posQty: position.quantity,
                                oldEntry: position.entryPrice, execPrice: executionPrice
                            });
                            newEntryPrice = executionPrice;
                        }

                        position.entryPrice = newEntryPrice

                        // Recalculate liquidation price
                        position.liquidationPrice = position.side === 'long'
                            ? position.entryPrice - (0.9 * position.margin / position.quantity)
                            : position.entryPrice + (0.9 * position.margin / position.quantity)

                        position.updatedAt = new Date()
                        await position.save({ session })
                    } else {
                        // Opposite side: Not allowed - user must close position first
                        throw new Error('Please close your existing position before opening a position in the opposite direction')
                    }
                } else {
                    const liqPrice = side === 'long'
                        ? executionPrice - (0.9 * marginRequired / baseQuantity)
                        : executionPrice + (0.9 * marginRequired / baseQuantity)

                    if (isNaN(executionPrice)) console.error('CRITICAL: executionPrice is NaN right before position create!', { symbol, side, executionPrice });
                    if (isNaN(marginRequired)) console.error('CRITICAL: marginRequired is NaN right before position create!', { qtyUSDT, levNum });

                    console.log('Creating NEW position with:', {
                        userId, symbol, side,
                        entryPrice: executionPrice, quantity: baseQuantity,
                        leverage: levNum, margin: marginRequired,
                        liquidationPrice: liqPrice
                    });

                    await FuturesPosition.create([{
                        userId, symbol, side, entryPrice: executionPrice,
                        quantity: baseQuantity, leverage: levNum, margin: marginRequired,
                        liquidationPrice: liqPrice
                    }], { session })
                }
            }
        })

        // Sync UI
        const userId = req.user!.id
        const symbol = (req as any).body.symbol;
        syncFuturesBalances(userId).catch(() => { });
        syncFuturesPosition(userId, symbol).catch(() => { });
        if (orderDoc) {
            syncOrder(userId, {
                _id: orderDoc._id.toString(),
                id: orderDoc._id.toString(),
                symbol: orderDoc.symbol,
                side: orderDoc.side,
                type: orderDoc.type,
                quantity: orderDoc.quantity,
                price: orderDoc.price,
                leverage: orderDoc.leverage,
                status: orderDoc.status,
                createdAt: orderDoc.createdAt
            });
        }

        return res.json(orderDoc)
    } catch (e: any) {
        return res.status(500).json({ error: e.message })
    } finally {
        await session.endSession()
    }
})

// Cancel a futures order
router.delete('/orders/:id', requireAuth, tradeLimiter, async (req: AuthRequest, res: Response) => {
    const session = await mongoose.startSession()
    try {
        let canceledSymbol = ''
        await session.withTransaction(async () => {
            const userId = (req as any).user?.id
            const orderId = req.params.id

            const order = await FuturesOrder.findOne({ _id: orderId, userId }).session(session)
            if (!order || order.status !== 'pending') throw new Error('Order not found or not pending')

            canceledSymbol = order.symbol
            const quote = order.symbol.endsWith('USDT') ? 'USDT' : order.symbol.endsWith('USDC') ? 'USDC' : 'USDT'
            const futAcc = await FuturesAccount.findOne({ userId, asset: quote }).session(session)
            if (futAcc) {
                const marginReserved = order.margin || 0
                futAcc.reserved = Math.max(0, futAcc.reserved - marginReserved)
                futAcc.available += marginReserved
                await futAcc.save({ session })
            }

            order.status = 'cancelled'
            await order.save({ session })
        })

        const userId = (req as any).user?.id
        const orderId = req.params.id;
        syncFuturesBalances(userId).catch(() => { });
        syncFuturesPosition(userId, canceledSymbol).catch(() => { });
        syncOrder(userId, { _id: orderId, id: orderId, status: 'cancelled' });

        return res.json({ success: true })
    } catch (e: any) {
        return res.status(500).json({ error: e.message })
    } finally {
        await session.endSession()
    }
})

// Get active positions and orders
router.get('/data', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
        const userId = (req as any).user?.id
        if (!userId) return res.status(401).json({ error: 'Unauthorized' })

        const [orders, positions] = await Promise.all([
            FuturesOrder.find({ userId }).sort({ createdAt: -1 }).limit(50),
            FuturesPosition.find({ userId })
        ])

        return res.json({ orders, positions })
    } catch (e: any) {
        return res.status(500).json({ error: e.message })
    }
})

// Get position history
router.get('/history', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id
        const history = await FuturesPositionHistory.find({ userId }).sort({ closedAt: -1 }).limit(50)
        return res.json(history)
    } catch (e: any) {
        return res.status(500).json({ error: e.message })
    }
})

// Close a futures position
router.post('/close-position', requireAuth, tradeLimiter, async (req: AuthRequest, res: Response) => {
    try {
        const userId = (req as any).user?.id
        const { symbol, quantity } = (req as any).body

        const position = await FuturesPosition.findOne({ userId, symbol })
        if (!position) throw new Error('Position not found')

        let closePrice = position.entryPrice
        try {
            closePrice = await priceService.getPrice(symbol)
        } catch { }

        await futuresEngine.executePositionClose(position._id.toString(), closePrice, quantity ? parseFloat(quantity) : undefined)

        return res.json({ success: true })
    } catch (e: any) {
        return res.status(500).json({ error: e.message })
    }
})

// Set TP/SL for a position
router.post('/positions/tpsl', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
        const userId = (req as any).user?.id
        const { symbol, tpPrice, slPrice, tpQuantity, slQuantity } = (req as any).body

        const position = await FuturesPosition.findOne({ userId, symbol })
        if (!position) return res.status(404).json({ error: 'Position not found' })

        position.tpPrice = tpPrice !== undefined ? Number(tpPrice) : position.tpPrice
        position.tpQuantity = tpQuantity !== undefined ? Number(tpQuantity) : position.tpQuantity
        position.slPrice = slPrice !== undefined ? Number(slPrice) : position.slPrice
        position.slQuantity = slQuantity !== undefined ? Number(slQuantity) : position.slQuantity
        position.updatedAt = new Date()
        await position.save()

        // Sync UI
        await syncFuturesPosition(userId, symbol)

        return res.json({ success: true, tpPrice: position.tpPrice, slPrice: position.slPrice })
    } catch (e: any) {
        return res.status(500).json({ error: e.message })
    }
})

export default router
