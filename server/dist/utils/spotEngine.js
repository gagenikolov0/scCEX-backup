"use strict";
/**
 * Handles 100% of the Limit Order matching logic for Spot
 * Just a dumb engine that gets dinged every 1 second by spotTicks.ts stream to check db if any orders should be filled and it fills them
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchSpotLimitOrders = matchSpotLimitOrders;
const mongoose_1 = __importDefault(require("mongoose"));
const SpotOrder_1 = require("../models/SpotOrder");
const moneyMovement_1 = require("./moneyMovement");
const emitters_1 = require("./emitters");
async function matchSpotLimitOrders(symbol, currentPrice) {
    const session = await mongoose_1.default.startSession();
    try {
        const executedOrders = [];
        await session.withTransaction(async () => {
            const pendingOrders = await SpotOrder_1.SpotOrder.find({ symbol, status: "pending" }).session(session);
            for (const order of pendingOrders) {
                const limitPrice = parseFloat(order.priceQuote.toString());
                const quantityBase = parseFloat(order.quantityBase.toString());
                const quoteAmount = parseFloat(order.quoteAmount.toString());
                let shouldExecute = order.side === "buy" ? currentPrice <= limitPrice : currentPrice >= limitPrice;
                if (shouldExecute) {
                    const userId = order.userId;
                    if (order.side === "buy") {
                        await (0, moneyMovement_1.moveMoney)(session, userId, order.quoteAsset, quoteAmount, 'UNRESERVE');
                        await (0, moneyMovement_1.moveMoney)(session, userId, order.quoteAsset, quoteAmount, 'SPEND');
                        await (0, moneyMovement_1.moveMoney)(session, userId, order.baseAsset, quantityBase, 'RECEIVE');
                    }
                    else {
                        await (0, moneyMovement_1.moveMoney)(session, userId, order.baseAsset, quantityBase, 'UNRESERVE');
                        await (0, moneyMovement_1.moveMoney)(session, userId, order.baseAsset, quantityBase, 'SPEND');
                        await (0, moneyMovement_1.moveMoney)(session, userId, order.quoteAsset, quoteAmount, 'RECEIVE');
                    }
                    await SpotOrder_1.SpotOrder.updateOne({ _id: order._id }, { status: "filled", updatedAt: new Date() }, { session });
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
                    await (0, emitters_1.syncStableBalances)(order.userId);
                    await (0, emitters_1.syncPosition)(order.userId, order.asset);
                    (0, emitters_1.syncOrder)(order.userId, { id: order.id, status: "filled" });
                }
                catch { }
            })();
        }
        if (executedOrders.length > 0) {
            console.log(`[MATCHING] Executed ${executedOrders.length} limit orders for ${symbol} @ ${currentPrice}`);
        }
    }
    catch (error) {
        console.error('Matching engine error:', error);
    }
    finally {
        await session.endSession();
    }
}
//# sourceMappingURL=spotEngine.js.map