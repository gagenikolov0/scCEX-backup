import { Router, type Response } from 'express'
import mongoose from 'mongoose'
import { requireAuth, type AuthRequest } from '../middleware/auth'
import { FuturesOrder } from '../models/FuturesOrder'
import { FuturesPosition } from '../models/FuturesPosition'
import { FuturesAccount } from '../models/FuturesAccount'
import { FuturesPositionHistory } from '../models/FuturesPositionHistory'
import { priceService } from '../utils/priceService'
import { moveMoney } from '../utils/moneyMovement'
import { syncFuturesBalances, syncOrder, syncFuturesPosition } from '../utils/emitters'

const router = Router()

// Place a futures order
router.post('/orders', requireAuth, async (req: AuthRequest, res: Response) => {
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
            const marginRequired = qtyUSDT / levNum

            const futAcc = await FuturesAccount.findOne({ userId, asset: quote }).session(session)
            if (!futAcc || futAcc.available < marginRequired) {
                throw new Error(`Insufficient ${quote} in Futures wallet`)
            }

            futAcc.available -= marginRequired
            if (type === 'limit') futAcc.reserved += marginRequired
            await futAcc.save({ session })

            const baseQuantity = qtyUSDT / executionPrice

            const order = await FuturesOrder.create([{
                userId, symbol, side, type,
                quantity: baseQuantity,
                leverage: levNum,
                price: type === 'limit' ? Number(price) : executionPrice,
                status: type === 'market' ? 'filled' : 'pending',
                averagePrice: type === 'market' ? executionPrice : 0
            }], { session })
            orderDoc = order[0]

            if (type === 'market') {
                let position = await FuturesPosition.findOne({ userId, symbol }).session(session)
                if (position) {
                    position.quantity += baseQuantity
                    position.margin += marginRequired
                    position.updatedAt = new Date()
                    await position.save({ session })
                } else {
                    const liqPrice = side === 'long'
                        ? executionPrice - (0.9 * marginRequired / baseQuantity)
                        : executionPrice + (0.9 * marginRequired / baseQuantity);

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
        (async () => {
            try {
                await syncFuturesBalances(userId)
                await syncFuturesPosition(userId, symbol)
                if (orderDoc) syncOrder(userId, { id: orderDoc._id, status: orderDoc.status })
            } catch { }
        })();

        return res.json(orderDoc)
    } catch (e: any) {
        return res.status(500).json({ error: e.message })
    } finally {
        await session.endSession()
    }
})

// Cancel a futures order
router.delete('/orders/:id', requireAuth, async (req: AuthRequest, res: Response) => {
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
            const marginReserved = (order.quantity * (order.price || 0)) / order.leverage

            const futAcc = await FuturesAccount.findOne({ userId, asset: quote }).session(session)
            if (futAcc) {
                futAcc.reserved -= marginReserved
                futAcc.available += marginReserved
                await futAcc.save({ session })
            }

            order.status = 'cancelled'
            await order.save({ session })
        })

        const userId = (req as any).user?.id
        const orderId = req.params.id;
        (async () => {
            try {
                await syncFuturesBalances(userId)
                await syncFuturesPosition(userId, canceledSymbol)
                syncOrder(userId, { id: orderId, status: 'cancelled' })
            } catch { }
        })();

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
router.post('/close-position', requireAuth, async (req: AuthRequest, res: Response) => {
    const session = await mongoose.startSession()
    try {
        const userId = (req as any).user?.id
        const { symbol } = (req as any).body

        await session.withTransaction(async () => {
            const position = await FuturesPosition.findOne({ userId, symbol }).session(session)
            if (!position) throw new Error('Position not found')

            const quote = symbol.endsWith('USDT') ? 'USDT' : symbol.endsWith('USDC') ? 'USDC' : 'USDT'
            let closePrice = position.entryPrice
            try {
                closePrice = await priceService.getPrice(symbol)
            } catch { }

            const diff = position.side === 'long'
                ? (closePrice - position.entryPrice)
                : (position.entryPrice - closePrice)

            const pnl = position.quantity * diff
            const amountToRefund = Math.max(0, position.margin + pnl)

            await FuturesAccount.updateOne(
                { userId, asset: quote },
                { $inc: { available: amountToRefund }, updatedAt: new Date() },
                { session, upsert: true }
            )

            // Record history
            await FuturesPositionHistory.create([{
                userId,
                symbol: position.symbol,
                side: position.side,
                entryPrice: position.entryPrice,
                exitPrice: closePrice,
                quantity: position.quantity,
                leverage: position.leverage,
                margin: position.margin,
                realizedPnL: pnl,
                closedAt: new Date()
            }], { session });

            await FuturesPosition.deleteOne({ _id: position._id }).session(session)
        });

        // Sync UI
        (async () => {
            try {
                await syncFuturesBalances(userId)
                await syncFuturesPosition(userId, symbol)
            } catch { }
        })();

        return res.json({ success: true })
    } catch (e: any) {
        return res.status(500).json({ error: e.message })
    } finally {
        await session.endSession()
    }
})

export default router
