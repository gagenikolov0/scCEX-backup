import { Router, type Request, type Response } from "express";
import mongoose from "mongoose";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { User } from "../models/User";
import { SpotOrder } from "../models/SpotOrder";
import SpotPosition from "../models/SpotPosition";
import { emitAccountEvent } from "../ws/streams/account";

const router = Router();

// Helper to fetch latest price from MEXC
async function fetchSpotPrice(symbol: string): Promise<number> {
  const url = `https://api.mexc.com/api/v3/ticker/price?symbol=${encodeURIComponent(symbol)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Upstream price error");
  const j = (await res.json()) as any;
  const p = parseFloat(j?.price ?? j?.data?.price ?? "NaN");
  if (!Number.isFinite(p) || p <= 0) throw new Error("Invalid price");
  return p;
}

// POST /api/spot/orders - place market or limit order
// Body: { symbol: "BTCUSDT", side: "buy"|"sell", quantity: string, price?: string, orderType: "market"|"limit" }
router.post("/orders", requireAuth, async (req: AuthRequest, res: Response) => {
  const { symbol, side, quantity, price: limitPrice, orderType = "market" } = req.body || {};
  const sym = typeof symbol === "string" ? symbol.toUpperCase() : "";
  const sd = side === "buy" || side === "sell" ? side : null;
  const qtyStr = typeof quantity === "string" ? quantity : String(quantity ?? "");
  const isLimit = orderType === "limit";
  
  if (!sym || !sd) return res.status(400).json({ error: "Invalid input" });
  if (!/^\d+(?:\.\d+)?$/.test(qtyStr)) return res.status(400).json({ error: "Invalid quantity" });
  if (isLimit && (!limitPrice || !/^\d+(?:\.\d+)?$/.test(limitPrice))) return res.status(400).json({ error: "Invalid limit price" });
  
  // Derive base and quote
  const quote = sym.endsWith("USDT") ? "USDT" : sym.endsWith("USDC") ? "USDC" : null;
  if (!quote) return res.status(400).json({ error: "Unsupported quote" });
  const base = sym.replace(/(USDT|USDC)$/i, "");

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const currentPrice = await fetchSpotPrice(sym);
    const user = await User.findById(req.user!.id).session(session);
    if (!user) {
      await session.abortTransaction();
      return res.status(404).json({ error: "User not found" });
    }

    const qtyBase = qtyStr
    const price = isLimit ? parseFloat(limitPrice) : currentPrice;
    const quoteAmtNum = parseFloat(qtyStr) * price;
    const quoteAmt = String(quoteAmtNum);
    const priceDec = String(price);

    // Get quote balance from SpotPosition
    const quotePosition = await SpotPosition.findOne({ userId: String(user._id), asset: quote }).session(session);
    const avail = quotePosition?.available?.toString() || "0";

    // For limit orders, check if they can execute immediately
    if (isLimit) {
      const canExecute = sd === "buy" ? 
        currentPrice <= price : 
        currentPrice >= price;
      
      if (canExecute) {
        // Execute immediately as a market order (fall through to existing market order logic)
      } else {
        if (sd === "buy") {
          // Buy limit order: check and reserve USDT
          if (parseFloat(avail) < quoteAmtNum) {
            await session.abortTransaction()
            return res.status(400).json({ error: "Insufficient USDT balance" })
          }
          
          const newAvailable = (parseFloat(avail) - quoteAmtNum).toFixed(8)
          const newReserved = (parseFloat(quotePosition?.reserved?.toString() || "0") + quoteAmtNum).toFixed(8)
          
          await SpotPosition.updateOne(
            { userId: String(user._id), asset: quote },
            { $set: { available: newAvailable, reserved: newReserved } },
            { session }
          )
        } else {
          // Sell limit order: check and reserve base asset
          const basePosition = await SpotPosition.findOne({ userId: String(user._id), asset: base }).session(session);
          const baseAvail = basePosition?.available?.toString() || "0";
          
          if (parseFloat(baseAvail) < parseFloat(qtyStr)) {
            await session.abortTransaction()
            return res.status(400).json({ error: "Insufficient base balance" })
          }
          
          const newBaseAvailable = (parseFloat(baseAvail) - parseFloat(qtyStr)).toFixed(8)
          const newBaseReserved = (parseFloat(basePosition?.reserved?.toString() || "0") + parseFloat(qtyStr)).toFixed(8)
          
          await SpotPosition.updateOne(
            { userId: String(user._id), asset: base },
            { $set: { available: newBaseAvailable, reserved: newBaseReserved } },
            { session }
          )
        }

        // Create pending order
        const created = await new SpotOrder({
          userId: String(user._id), symbol: sym, baseAsset: base, quoteAsset: quote, side: sd,
          quantityBase: qtyBase, priceQuote: priceDec, quoteAmount: quoteAmt, status: "pending",
        }).save({ session });

        await session.commitTransaction();
        return res.status(201).json({
          id: created._id, symbol: sym, side: sd, quantity: qtyStr, price: String(price),
          quoteAmount: String(quoteAmtNum), status: "pending", createdAt: created.createdAt,
        });
      }
    }

    // Market order execution (existing logic)
    if (sd === "buy") {
      // Spend quote; increase base position
      if (parseFloat(avail) < quoteAmtNum) {
        await session.abortTransaction();
        return res.status(400).json({ error: "Insufficient quote balance" });
      }
      
      // Update quote balance in SpotPosition - simple string math
      const newQuoteAvailable = (parseFloat(avail) - quoteAmtNum).toFixed(8);
      
      await SpotPosition.updateOne(
        { userId: String(user._id), asset: quote },
        {
          $set: {
            available: newQuoteAvailable,
          },
        },
        { session }
      );
      
      // Increase base position - simple string math
      const newBaseAvailable = parseFloat(qtyStr).toFixed(8);
      
      await SpotPosition.updateOne(
        { userId: String(user._id), asset: base },
        {
          $set: {
            available: newBaseAvailable,
          },
        },
        { upsert: true, session }
      );
    } else {
      // Require holdings and reduce base; credit quote
      const pos = await SpotPosition.findOne({ userId: String(user._id), asset: base }).session(session);
      const have = pos ? parseFloat(pos.available?.toString() ?? "0") : 0;
      const qtyNum = parseFloat(qtyStr);
      if (have < qtyNum) {
        await session.abortTransaction();
        return res.status(400).json({ error: "Insufficient base holdings" });
      }
      
      // Reduce base position - simple string math
      const newBaseAvailable = (have - qtyNum).toFixed(8);
      await SpotPosition.updateOne(
        { userId: String(user._id), asset: base },
        {
          $set: {
            available: newBaseAvailable,
          },
        },
        { session }
      );
      
      // Increase quote balance in SpotPosition - simple string math
      const newQuoteAvailable = (parseFloat(avail) + quoteAmtNum).toFixed(8);
      
      await SpotPosition.updateOne(
        { userId: String(user._id), asset: quote },
        {
          $set: {
            available: newQuoteAvailable,
          },
        },
        { upsert: true, session }
      );
    }

    // Remove old user.save() since we're not modifying User model anymore

    const created = await new SpotOrder({
      userId: String(user._id),
      symbol: sym,
      baseAsset: base,
      quoteAsset: quote,
      side: sd,
      quantityBase: qtyBase,
      priceQuote: priceDec,
      quoteAmount: quoteAmt,
      status: "filled",
    }).save({ session });

    await session.commitTransaction();
    
    // Emit account events using new SpotPosition system
    try {
      // Get updated quote balance
      const quotePos = await SpotPosition.findOne({ userId: String(user._id), asset: quote }).lean()
      if (quotePos) {
        emitAccountEvent(String(user._id), {
          kind: 'balance',
          spotAvailable: {
            USDT: quote === 'USDT' ? quotePos.available?.toString() ?? '0' : '0',
            USDC: quote === 'USDC' ? quotePos.available?.toString() ?? '0' : '0',
          }
        })
      }
      
      // Get updated base position
      const basePos = await SpotPosition.findOne({ userId: String(user._id), asset: base }).lean()
      if (basePos) {
        emitAccountEvent(String(user._id), {
          kind: 'position',
          asset: base,
          available: basePos.available?.toString() ?? '0',
        })
      }
    } catch {}
    emitAccountEvent(String(user._id), { kind: 'order', order: {
      id: created._id, symbol: sym, side: sd, quantity: qtyStr,
      price: String(price), quoteAmount: String(quoteAmtNum), status: 'filled', createdAt: created.createdAt
    } })
    return res.status(201).json({
      id: created._id,
      symbol: sym,
      side: sd,
      quantity: qtyStr,
      price: String(price),
      quoteAmount: String(quoteAmtNum),
      status: "filled",
      createdAt: created.createdAt,
    });
  } catch (e: any) {
    try { await session.abortTransaction(); } catch {}
    return res.status(500).json({ error: "Order failed" });
  } finally {
    session.endSession();
  }
});

// GET /api/spot/orders - list recent orders
router.get("/orders", requireAuth, async (req: AuthRequest, res: Response) => {
  const limit = Math.min(parseInt(String((req.query as any)?.limit ?? "50"), 10) || 50, 200);
  const rows = await SpotOrder.find({ userId: req.user!.id })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  return res.json(
    rows.map((r) => ({
      id: String(r._id),
      symbol: r.symbol,
      side: r.side,
      quantity: r.quantityBase?.toString?.() ?? "0",
      price: r.priceQuote?.toString?.() ?? "0",
      quoteAmount: r.quoteAmount?.toString?.() ?? "0",
      status: r.status,
      createdAt: r.createdAt,
    }))
  );
});

// GET /api/spot/positions - list spot positions for current user
router.get("/positions", requireAuth, async (req: AuthRequest, res: Response) => {
  const rows = await SpotPosition.find({ userId: req.user!.id }).lean();
  return res.json(
    rows.map((r) => ({
      asset: r.asset,
      available: r.available?.toString() ?? "0",
      reserved: r.reserved?.toString() ?? "0",
      updatedAt: r.updatedAt,
    }))
  );
});

// DELETE /api/spot/orders/:id - cancel pending order
router.delete("/orders/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  const orderId = req.params.id;
  if (!orderId) return res.status(400).json({ error: "Order ID required" });

  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const order = await SpotOrder.findOne({ _id: orderId, userId: req.user!.id }).session(session);
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.status !== "pending") return res.status(400).json({ error: "Only pending orders can be cancelled" });

    // Update order status to rejected
    await SpotOrder.updateOne({ _id: orderId }, { status: "rejected" }, { session });
    
    // Return reserved funds back to available balance based on order side
    if (order.side === "buy") {
      const quoteAmount = parseFloat(order.quoteAmount?.toString() || "0");
      if (quoteAmount > 0) {
        const quotePosition = await SpotPosition.findOne({ userId: req.user!.id, asset: order.quoteAsset }).session(session);
        if (quotePosition) {
          await SpotPosition.updateOne(
            { userId: req.user!.id, asset: order.quoteAsset },
            {
              $set: {
                available: (parseFloat(quotePosition.available?.toString() || "0") + quoteAmount).toFixed(8),
                reserved: (parseFloat(quotePosition.reserved?.toString() || "0") - quoteAmount).toFixed(8)
              }
            },
            { session }
          );
        }
      }
    } else {
      const baseQuantity = parseFloat(order.quantityBase?.toString() || "0");
      if (baseQuantity > 0) {
        const basePosition = await SpotPosition.findOne({ userId: req.user!.id, asset: order.baseAsset }).session(session);
        if (basePosition) {
          await SpotPosition.updateOne(
            { userId: req.user!.id, asset: order.baseAsset },
            {
              $set: {
                available: (parseFloat(basePosition.available?.toString() || "0") + baseQuantity).toFixed(8),
                reserved: (parseFloat(basePosition.reserved?.toString() || "0") - baseQuantity).toFixed(8)
              }
            },
            { session }
          );
        }
      }
    }
    
    await session.commitTransaction();
    return res.json({ success: true });
  } catch (error) {
    await session.abortTransaction();
    return res.status(500).json({ error: "Cancel failed" });
  } finally {
    session.endSession();
  }
});

export default router;


