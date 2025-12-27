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
import { futuresEngine } from '../utils/futuresEngine'

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
                    position.quantity += baseQuantity
                    position.margin += marginRequired
                    position.updatedAt = new Date()
                    // 3. Update the position
                    await position.save({ session })
                } else {
                    const liqPrice = side === 'long'
                        ? executionPrice - (0.9 * marginRequired / baseQuantity)
                        : executionPrice + (0.9 * marginRequired / baseQuantity)

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
