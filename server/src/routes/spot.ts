import { Router, type Request, type Response } from "express";
import mongoose from "mongoose";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { User } from "../models/User";
import { SpotOrder } from "../models/SpotOrder";
import SpotPosition from "../models/SpotPosition";
import { emitAccountEvent } from "../ws/streams/account";
import { moveMoney } from "../utils/moneyMovement";
import { priceService } from "../utils/priceService";
import { syncStableBalances, syncSpotPosition, syncOrder } from "../utils/emitters";

const router = Router();


// ==========================================
// 4. MAIN ROUTE
// ==========================================

router.post("/orders", requireAuth, async (req: AuthRequest, res: Response) => {
  const { symbol, side, quantity, price: limitPrice, orderType = "market" } = req.body || {};

  // VALIDATION
  const sym = typeof symbol === "string" ? symbol.toUpperCase() : "";
  const sd = side === "buy" || side === "sell" ? side : null;
  const qtyStr = typeof quantity === "string" ? quantity : String(quantity ?? "");
  const isLimit = orderType === "limit";

  if (!sym || !sd) return res.status(400).json({ error: "Invalid input" });
  if (!/^\d+(?:\.\d+)?$/.test(qtyStr)) return res.status(400).json({ error: "Invalid quantity" });
  if (isLimit && (!limitPrice || !/^\d+(?:\.\d+)?$/.test(limitPrice))) return res.status(400).json({ error: "Invalid limit price" });

  const quote = sym.endsWith("USDT") ? "USDT" : sym.endsWith("USDC") ? "USDC" : null;
  if (!quote) return res.status(400).json({ error: "Unsupported quote" });

  const base = sym.replace(/(USDT|USDC)$/i, ""); // Remove quote from symbol

  const session = await mongoose.startSession();
  try {
    const userId = req.user!.id;
    let orderRes: any = null;

    await session.withTransaction(async () => {
      const currentPrice = await priceService.getPrice(sym);
      const qtyBase = parseFloat(qtyStr);
      const executionPrice = isLimit ? parseFloat(limitPrice) : currentPrice;
      const quoteAmount = qtyBase * executionPrice;

      console.log(`[EXECUTION] ${sym} Price: ${currentPrice} | Order: ${sd.toUpperCase()} ${qtyBase} @ ${executionPrice}`);

      let status = "filled";
      let isPending = false;

      if (isLimit) {
        const isFillable = (sd === "buy" && executionPrice >= currentPrice) ||
          (sd === "sell" && executionPrice <= currentPrice);
        if (!isFillable) {
          status = "pending";
          isPending = true;
        }
      }

      if (isPending) {
        if (sd === "buy") await moveMoney(session, userId, quote, quoteAmount, 'RESERVE');
        else await moveMoney(session, userId, base, qtyBase, 'RESERVE');
      } else {
        if (sd === "buy") {
          await moveMoney(session, userId, quote, quoteAmount, 'SPEND');
          await moveMoney(session, userId, base, qtyBase, 'RECEIVE');
        } else {
          await moveMoney(session, userId, base, qtyBase, 'SPEND');
          await moveMoney(session, userId, quote, quoteAmount, 'RECEIVE');
        }
      }

      const orderDoc = await new SpotOrder({
        userId, symbol: sym, baseAsset: base, quoteAsset: quote, side: sd,
        quantityBase: String(qtyBase), priceQuote: String(executionPrice), quoteAmount: String(quoteAmount),
        status,
      }).save({ session });

      orderRes = {
        id: orderDoc._id, symbol: sym, side: sd, quantity: String(qtyBase),
        price: String(executionPrice), quoteAmount: String(quoteAmount), status, createdAt: orderDoc.createdAt
      };
    });

    (async () => {
      try {
        await syncStableBalances(userId);
        await syncSpotPosition(userId, base);
        syncOrder(userId, orderRes);
      } catch { }
    })();

    return res.status(201).json(orderRes);
  } catch (e: any) {
    console.error(`Order Error: ${e.message}`);
    return res.status(400).json({ error: e.message || "Order failed" });
  } finally {
    await session.endSession();
  }
});








// GET /api/spot/orders
router.get("/orders", requireAuth, async (req: AuthRequest, res: Response) => {
  const limit = Math.min(parseInt(String((req.query as any)?.limit ?? "50"), 10) || 50, 200);
  const rows = await SpotOrder.find({ userId: req.user!.id }).sort({ createdAt: -1 }).limit(limit).lean();
  return res.json(
    rows.map((r) => ({
      id: String(r._id),
      symbol: r.symbol,
      side: r.side,
      quantity: r.quantityBase ? String(r.quantityBase) : "0",
      price: r.priceQuote ? String(r.priceQuote) : "0",
      quoteAmount: r.quoteAmount ? String(r.quoteAmount) : "0",
      status: r.status,
      createdAt: r.createdAt,
    }))
  );
});

// GET /api/spot/positions
router.get("/positions", requireAuth, async (req: AuthRequest, res: Response) => {
  const rows = await SpotPosition.find({ userId: req.user!.id }).lean();
  return res.json(rows.map((r) => ({
    asset: r.asset, available: r.available ?? "0", reserved: r.reserved ?? "0", updatedAt: r.updatedAt,
  })));
});

// GET /api/spot/history
router.get("/history", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const history = await SpotOrder.find({ userId, status: 'filled' }).sort({ createdAt: -1 }).limit(50).lean();
    return res.json(history);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// DELETE /api/spot/orders/:id
router.delete("/orders/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  const orderId = req.params.id;
  if (!orderId) return res.status(400).json({ error: "ID required" });

  const session = await mongoose.startSession();
  try {
    const userId = req.user!.id;
    let orderBaseAsset = '';
    let orderIdToEmit = '';

    await session.withTransaction(async () => {
      const order = await SpotOrder.findOne({ _id: orderId, userId }).session(session);
      if (!order || order.status !== "pending") throw new Error("Cannot cancel");

      orderBaseAsset = order.baseAsset;
      orderIdToEmit = String(order._id);
      await SpotOrder.updateOne({ _id: orderId }, { status: "rejected" }, { session });

      if (order.side === "buy") {
        await moveMoney(session, userId, order.quoteAsset, parseFloat(order.quoteAmount.toString()), 'UNRESERVE');
      } else {
        await moveMoney(session, userId, order.baseAsset, parseFloat(order.quantityBase.toString()), 'UNRESERVE');
      }
    });

    (async () => {
      try {
        await syncStableBalances(userId);
        await syncSpotPosition(userId, orderBaseAsset);
        syncOrder(userId, { id: orderIdToEmit, status: 'rejected' });
      } catch { }
    })();

    return res.json({ success: true });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || "Cancel failed" });
  } finally {
    await session.endSession();
  }
});

export default router;
