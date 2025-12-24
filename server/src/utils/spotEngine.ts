/**
 * Handles 100% of the Limit Order matching logic for Spot
 * Just a dumb engine that gets dinged every 1 second by spotTicks.ts stream to check db if any orders should be filled and it fills them
 */

import mongoose from "mongoose";
import { SpotOrder } from "../models/SpotOrder";
import { moveMoney } from "./moneyMovement";
import { syncStableBalances, syncPosition, syncOrder } from "./emitters";

export async function matchSpotLimitOrders(symbol: string, currentPrice: number) {
  const session = await mongoose.startSession();
  try {
    const executedOrders: any[] = [];
    await session.withTransaction(async () => {
      const pendingOrders = await SpotOrder.find({ symbol, status: "pending" }).session(session);
      for (const order of pendingOrders) {
        const limitPrice = parseFloat(order.priceQuote.toString());
        const quantityBase = parseFloat(order.quantityBase.toString());
        const quoteAmount = parseFloat(order.quoteAmount.toString());

        let shouldExecute = order.side === "buy" ? currentPrice <= limitPrice : currentPrice >= limitPrice;

        if (shouldExecute) {
          const userId = order.userId;
          if (order.side === "buy") {
            await moveMoney(session, userId, order.quoteAsset, quoteAmount, 'UNRESERVE');
            await moveMoney(session, userId, order.quoteAsset, quoteAmount, 'SPEND');
            await moveMoney(session, userId, order.baseAsset, quantityBase, 'RECEIVE');
          } else {
            await moveMoney(session, userId, order.baseAsset, quantityBase, 'UNRESERVE');
            await moveMoney(session, userId, order.baseAsset, quantityBase, 'SPEND');
            await moveMoney(session, userId, order.quoteAsset, quoteAmount, 'RECEIVE');
          }

          await SpotOrder.updateOne({ _id: order._id }, { status: "filled", updatedAt: new Date() }, { session });

          executedOrders.push({
            id: order._id,
            userId: order.userId,
            symbol: order.symbol,
            side: order.side,
            quantity: order.quantityBase.toString(),
            asset: order.baseAsset
          });
        }
      }
    });

    for (const order of executedOrders) {
      (async () => {
        try {
          await syncStableBalances(order.userId);
          await syncPosition(order.userId, order.asset);
          syncOrder(order.userId, { id: order.id, status: "filled" });
        } catch { }
      })();
    }

    if (executedOrders.length > 0) {
      console.log(`[MATCHING] Executed ${executedOrders.length} limit orders for ${symbol} @ ${currentPrice}`);
    }
  } catch (error) {
    console.error('Matching engine error:', error);
  } finally {
    await session.endSession();
  }
}
