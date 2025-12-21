import { Router, type Response } from 'express'
import mongoose from 'mongoose'
import { requireAuth, type AuthRequest } from '../middleware/auth'
import { FuturesOrder } from '../models/FuturesOrder'
import { FuturesPosition } from '../models/FuturesPosition'
import { FuturesAccount } from '../models/FuturesAccount'
import { priceService } from '../utils/priceService'
import { moveMoney } from '../utils/moneyMovement'
import { syncFuturesBalances, syncOrder } from '../utils/emitters'

const router = Router()

// Place a futures order
router.post('/orders', requireAuth, async (req: AuthRequest, res: Response) => {
    const session = await mongoose.startSession()
    session.startTransaction()

    try {
        const { symbol, side, type, quantity, leverage, price } = (req as any).body
        const userId = req.user!.id

        const quote = symbol.endsWith('USDT') ? 'USDT' : symbol.endsWith('USDC') ? 'USDC' : null
        if (!quote) throw new Error('Unsupported quote asset')

        // Validate market price exists
        let executionPrice = Number(price)
        if (type === 'market') {
            try {
                executionPrice = await priceService.getPrice(symbol)
            } catch (e) {
                return res.status(400).json({ error: 'Market price unavailable' })
            }
        }

        const qtyUSDT = Number(quantity)
        const levNum = Number(leverage)
        const marginRequired = qtyUSDT / levNum

        // 1. Deduct Margin from FuturesAccount
        const futAcc = await FuturesAccount.findOne({ userId, asset: quote }).session(session)
        if (!futAcc || futAcc.available < marginRequired) {
            throw new Error(`Insufficient ${quote} in Futures wallet`)
        }

        futAcc.available -= marginRequired
        if (type === 'limit') futAcc.reserved += marginRequired
        await futAcc.save({ session })

        const baseQuantity = qtyUSDT / executionPrice

        // 2. Create Order
        const order = await FuturesOrder.create([{
            userId,
            symbol,
            side,
            type,
            quantity: baseQuantity,
            leverage: levNum,
            price: type === 'limit' ? Number(price) : executionPrice,
            status: type === 'market' ? 'filled' : 'pending',
            averagePrice: type === 'market' ? executionPrice : 0
        }], { session })

        const orderDoc = order[0]

        // 3. Update Position if Market
        if (type === 'market') {
            let position = await FuturesPosition.findOne({ userId, symbol }).session(session)
            if (position) {
                // If opening same side, add. If opposite, subtract (for now just add to prove math)
                position.quantity += baseQuantity
                position.margin += marginRequired
                position.updatedAt = new Date()
                await position.save({ session })
            } else {
                await FuturesPosition.create([{
                    userId,
                    symbol,
                    side,
                    entryPrice: executionPrice,
                    quantity: baseQuantity,
                    leverage: levNum,
                    margin: marginRequired
                }], { session })
            }
        }

        await session.commitTransaction();

        // 4. Sync UI
        const finalOrder = orderDoc;
        (async () => {
            try {
                await syncFuturesBalances(userId)
                if (finalOrder) syncOrder(userId, { id: finalOrder._id, status: finalOrder.status })
            } catch { }
        })();

        return res.json(orderDoc)
    } catch (e: any) {
        await session.abortTransaction()
        return res.status(500).json({ error: e.message })
    } finally {
        session.endSession()
    }
})

// Cancel a futures order
router.delete('/orders/:id', requireAuth, async (req: AuthRequest, res: Response) => {
    const session = await mongoose.startSession()
    session.startTransaction()

    try {
        const userId = (req as any).user?.id
        const orderId = req.params.id

        const order = await FuturesOrder.findOne({ _id: orderId, userId }).session(session)
        if (!order || order.status !== 'pending') throw new Error('Order not found or not pending')

        const quote = order.symbol.endsWith('USDT') ? 'USDT' : order.symbol.endsWith('USDC') ? 'USDC' : 'USDT'

        // Use price from order if limit, or market price if somehow filled? pending orders always have price.
        const marginReserved = (order.quantity * (order.price || 0)) / order.leverage

        // 1. Return Margin to FuturesAccount
        const futAcc = await FuturesAccount.findOne({ userId, asset: quote }).session(session)
        if (futAcc) {
            futAcc.reserved -= marginReserved
            futAcc.available += marginReserved
            await futAcc.save({ session })
        }

        // 2. Update Order
        order.status = 'cancelled'
        await order.save({ session })

        await session.commitTransaction();

        // 3. Sync UI
        (async () => {
            try {
                await syncFuturesBalances(userId)
                syncOrder(userId, { id: order._id, status: 'cancelled' })
            } catch { }
        })();

        return res.json({ success: true })
    } catch (e: any) {
        await session.abortTransaction()
        return res.status(500).json({ error: e.message })
    } finally {
        session.endSession()
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

// Close a futures position
router.post('/close-position', requireAuth, async (req: AuthRequest, res: Response) => {
    const session = await mongoose.startSession()
    session.startTransaction()

    try {
        const userId = (req as any).user?.id
        const { symbol } = (req as any).body

        const position = await FuturesPosition.findOne({ userId, symbol }).session(session)
        if (!position) throw new Error('Position not found')

        const quote = symbol.endsWith('USDT') ? 'USDT' : symbol.endsWith('USDC') ? 'USDC' : 'USDT'

        let closePrice = position.entryPrice
        try {
            closePrice = await priceService.getPrice(symbol)
        } catch { }

        // Simplified PnL: (Close - Entry) * Quantity (for Long)
        // or (Entry - Close) * Quantity (for Short)
        const diff = position.side === 'long'
            ? (closePrice - position.entryPrice)
            : (position.entryPrice - closePrice)

        const pnl = position.quantity * diff
        const amountToRefund = Math.max(0, position.margin + pnl)

        // 1. Return Margin (+ PnL) to FuturesAccount
        await FuturesAccount.updateOne(
            { userId, asset: quote },
            { $inc: { available: amountToRefund }, updatedAt: new Date() },
            { session, upsert: true }
        )

        // 2. Delete Position
        await FuturesPosition.deleteOne({ _id: position._id }).session(session)

        await session.commitTransaction()

        return res.json({ success: true })
    } catch (e: any) {
        if (session.inTransaction()) await session.abortTransaction()
        return res.status(500).json({ error: e.message })
    } finally {
        session.endSession()
    }
})

export default router
