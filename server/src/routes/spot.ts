import { Router, type Request, type Response } from "express";
import mongoose from "mongoose";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { User } from "../models/User";
import { SpotOrder } from "../models/SpotOrder";
import SpotPosition from "../models/SpotPosition";
import { emitAccountEvent } from "../ws/streams/account";
import { moveMoney } from "../utils/moneyMovement";

const router = Router();







async function fetchSpotPrice(symbol: string): Promise<number> {
  const url = `https://api.mexc.com/api/v3/ticker/price?symbol=${encodeURIComponent(symbol)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Upstream price error");
  const j = (await res.json()) as any;
  const p = parseFloat(j?.price ?? j?.data?.price ?? "NaN");
  if (!Number.isFinite(p) || p <= 0) throw new Error("Invalid price");
  return p;
}


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
  session.startTransaction();

  try {
    const userId = req.user!.id;
    const currentPrice = await fetchSpotPrice(sym);

    const qtyBase = parseFloat(qtyStr);
    const executionPrice = isLimit ? parseFloat(limitPrice) : currentPrice;
    const quoteAmount = qtyBase * executionPrice; // CASINO MATH HAPPENS HERE

    console.log(`[EXECUTION] ${sym} Price: ${currentPrice} | Order: ${sd.toUpperCase()} ${qtyBase} @ ${executionPrice}`);

    let status = "filled";
    let isPending = false;

    // Check Limit Conditions
    if (isLimit) {
      const isFillable = (sd === "buy" && executionPrice >= currentPrice) ||
        (sd === "sell" && executionPrice <= currentPrice);
      if (!isFillable) {
        status = "pending";
        isPending = true;
      }
    }

    // LOGIC EXECUTION
    if (isPending) {
      // Just Lock the funds
      if (sd === "buy") await moveMoney(session, userId, quote, quoteAmount, 'RESERVE');
      else await moveMoney(session, userId, base, qtyBase, 'RESERVE');
    } else {
      // SWAP (The Casino Exchange)
      if (sd === "buy") {
        await moveMoney(session, userId, quote, quoteAmount, 'SPEND');
        await moveMoney(session, userId, base, qtyBase, 'RECEIVE');
      } else {
        await moveMoney(session, userId, base, qtyBase, 'SPEND');
        await moveMoney(session, userId, quote, quoteAmount, 'RECEIVE');
      }
    }

    // SAVE ORDER
    const orderDoc = await new SpotOrder({
      userId, symbol: sym, baseAsset: base, quoteAsset: quote, side: sd,
      quantityBase: String(qtyBase), priceQuote: String(executionPrice), quoteAmount: String(quoteAmount),
      status,
    }).save({ session });

    await session.commitTransaction();

    // EMIT UPDATES (Fire and forget)
    // We just emit balance/position for both assets involved to be sure state is synced
    const orderRes = {
      id: orderDoc._id, symbol: sym, side: sd, quantity: String(qtyBase),
      price: String(executionPrice), quoteAmount: String(quoteAmount), status, createdAt: orderDoc.createdAt
    };

    // We can fetch fresh state to emit accuarte numbers, or rely on moveMoney returns.
    // For safety, let's just trigger a balance check emit helper (reusing the one we had or similar logic inline)
    // Actually, let's keep it simple: The client will receive the "order" event and we can manually emit 
    // balances if we want perfect sync.
    // Below is a simplified emit that grabs fresh DB state to be safe.
    (async () => {
      try {
        const qP = await SpotPosition.findOne({ userId, asset: quote });
        const bP = await SpotPosition.findOne({ userId, asset: base });

        if (qP) {
          emitAccountEvent(userId, {
            kind: 'balance',
            spotAvailable: {
              USDT: quote === 'USDT' ? qP.available?.toString() ?? '0' : '0',
              USDC: quote === 'USDC' ? qP.available?.toString() ?? '0' : '0'
            }
          });
        }

        if (bP) {
          emitAccountEvent(userId, {
            kind: 'position',
            asset: base,
            available: bP.available?.toString() ?? '0'
          });
        }

        emitAccountEvent(userId, { kind: 'order', order: orderRes });
      } catch { }
    })();

    return res.status(201).json(orderRes);

  } catch (e: any) {
    await session.abortTransaction();
    console.error(`Order Error: ${e.message}`);
    return res.status(400).json({ error: e.message || "Order failed" });
  } finally {
    session.endSession();
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

// DELETE /api/spot/orders/:id
router.delete("/orders/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  const orderId = req.params.id;
  if (!orderId) return res.status(400).json({ error: "ID required" });

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const order = await SpotOrder.findOne({ _id: orderId, userId: req.user!.id }).session(session);
    if (!order || order.status !== "pending") return res.status(400).json({ error: "Cannot cancel" });

    await SpotOrder.updateOne({ _id: orderId }, { status: "rejected" }, { session });

    // REFUND (Use Universal Mover 'UNRESERVE')
    if (order.side === "buy") {
      await moveMoney(session, req.user!.id, order.quoteAsset, parseFloat(order.quoteAmount.toString()), 'UNRESERVE');
    } else {
      await moveMoney(session, req.user!.id, order.baseAsset, parseFloat(order.quantityBase.toString()), 'UNRESERVE');
    }

    await session.commitTransaction();
    return res.json({ success: true });
  } catch (e) {
    await session.abortTransaction();
    return res.status(500).json({ error: "Cancel failed" });
  } finally {
    session.endSession();
  }
});

export default router;
