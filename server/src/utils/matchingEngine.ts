import mongoose from "mongoose";
import { SpotOrder } from "../models/SpotOrder";
import SpotPosition from "../models/SpotPosition";
import { emitAccountEvent } from "../ws/streams/account";
import { moveMoney } from "./moneyMovement";
import { syncStableBalances, syncPosition, syncOrder } from "./emitters";

export async function matchLimitOrders(symbol: string, currentPrice: number) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Find all pending limit orders for this symbol
    const pendingOrders = await SpotOrder.find({
      symbol,
      status: "pending"
    }).session(session);

    const executedOrders: any[] = [];

    for (const order of pendingOrders) {
      const limitPrice = parseFloat(order.priceQuote.toString());
      const quantityBase = parseFloat(order.quantityBase.toString());
      const quoteAmount = parseFloat(order.quoteAmount.toString());

      let shouldExecute = false;

      if (order.side === "buy") {
        // Buy limit: execute if current price <= limit price
        shouldExecute = currentPrice <= limitPrice;
      } else {
        // Sell limit: execute if current price >= limit price
        shouldExecute = currentPrice >= limitPrice;
      }

      if (shouldExecute) {
        // Execute the order
        const userId = order.userId;

        if (order.side === "buy") {
          // Buy: spend quote, receive base
          await moveMoney(session, userId, order.quoteAsset, quoteAmount, 'UNRESERVE');
          await moveMoney(session, userId, order.quoteAsset, quoteAmount, 'SPEND');
          await moveMoney(session, userId, order.baseAsset, quantityBase, 'RECEIVE');
        } else {
          // Sell: spend base, receive quote
          await moveMoney(session, userId, order.baseAsset, quantityBase, 'UNRESERVE');
          await moveMoney(session, userId, order.baseAsset, quantityBase, 'SPEND');
          await moveMoney(session, userId, order.quoteAsset, quoteAmount, 'RECEIVE');
        }

        // Update order status
        await SpotOrder.updateOne(
          { _id: order._id },
          { status: "filled", updatedAt: new Date() },
          { session }
        );

        executedOrders.push({
          id: order._id,
          symbol: order.symbol,
          side: order.side,
          quantity: order.quantityBase.toString(),
          price: currentPrice.toString(), // Use actual execution price
          quoteAmount: order.quoteAmount.toString(),
          status: "filled",
          createdAt: order.createdAt
        });

        // Emit account updates for this user
        (async () => {
          try {
            await syncStableBalances(userId);
            await syncPosition(userId, order.baseAsset);
            syncOrder(userId, executedOrders[executedOrders.length - 1]);
          } catch (error) {
            console.error('Error emitting account updates:', error);
          }
        })();
      }
    }

    await session.commitTransaction();

    if (executedOrders.length > 0) {
      console.log(`[MATCHING] Executed ${executedOrders.length} limit orders for ${symbol} @ ${currentPrice}`);
    }

  } catch (error) {
    await session.abortTransaction();
    console.error('Matching engine error:', error);
  } finally {
    session.endSession();
  }
}
