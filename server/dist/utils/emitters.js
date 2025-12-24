"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncStableBalances = syncStableBalances;
exports.syncFuturesBalances = syncFuturesBalances;
exports.syncPosition = syncPosition;
exports.syncFuturesPosition = syncFuturesPosition;
exports.syncOrder = syncOrder;
const SpotPosition_1 = __importDefault(require("../models/SpotPosition"));
const FuturesAccount_1 = require("../models/FuturesAccount");
const FuturesPosition_1 = require("../models/FuturesPosition");
const account_1 = require("../ws/streams/account");
/**
 * Emits full stablecoin balance (USDT & USDC) to the user.
 * This fixes the "zero-out" bug by always fetching both from the database.
 */
async function syncStableBalances(userId) {
    try {
        const usdtPos = await SpotPosition_1.default.findOne({ userId, asset: 'USDT' }).lean();
        const usdcPos = await SpotPosition_1.default.findOne({ userId, asset: 'USDC' }).lean();
        (0, account_1.emitAccountEvent)(userId, {
            kind: 'balance',
            spotAvailable: {
                USDT: usdtPos?.available?.toString() ?? '0',
                USDC: usdcPos?.available?.toString() ?? '0'
            }
        });
    }
    catch (e) {
        console.error('Error syncing stable balances:', e);
    }
}
/**
 * Emits full futures balance (USDT & USDC) to the user.
 */
async function syncFuturesBalances(userId) {
    try {
        const usdtAcc = await FuturesAccount_1.FuturesAccount.findOne({ userId, asset: 'USDT' }).lean();
        const usdcAcc = await FuturesAccount_1.FuturesAccount.findOne({ userId, asset: 'USDC' }).lean();
        (0, account_1.emitAccountEvent)(userId, {
            kind: 'futuresBalance',
            futuresAvailable: {
                USDT: (usdtAcc?.available || 0).toString(),
                USDC: (usdcAcc?.available || 0).toString()
            }
        });
    }
    catch (e) {
        console.error('Error syncing futures balances:', e);
    }
}
/**
 * Emits updated position (including reserved) to the user.
 */
async function syncPosition(userId, asset) {
    if (['USDT', 'USDC'].includes(asset)) {
        return syncStableBalances(userId);
    }
    try {
        const pos = await SpotPosition_1.default.findOne({ userId, asset }).lean();
        if (pos) {
            (0, account_1.emitAccountEvent)(userId, {
                kind: 'position',
                asset: pos.asset,
                available: pos.available?.toString() ?? '0',
                reserved: pos.reserved?.toString() ?? '0'
            });
        }
    }
    catch (e) {
        console.error(`Error syncing position for ${asset}:`, e);
    }
}
/**
 * Emits updated futures position to the user.
 */
async function syncFuturesPosition(userId, symbol) {
    try {
        const pos = await FuturesPosition_1.FuturesPosition.findOne({ userId, symbol }).lean();
        (0, account_1.emitAccountEvent)(userId, {
            kind: 'futuresPosition',
            symbol,
            position: pos ? {
                symbol: pos.symbol,
                side: pos.side,
                quantity: pos.quantity,
                entryPrice: pos.entryPrice,
                leverage: pos.leverage,
                margin: pos.margin,
                liquidationPrice: pos.liquidationPrice
            } : null
        });
    }
    catch (e) {
        console.error(`Error syncing futures position for ${symbol}:`, e);
    }
}
/**
 * Emits order update.
 */
function syncOrder(userId, order) {
    (0, account_1.emitAccountEvent)(userId, { kind: 'order', order });
}
//# sourceMappingURL=emitters.js.map