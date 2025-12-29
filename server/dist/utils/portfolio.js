"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateTotalPortfolioUSD = calculateTotalPortfolioUSD;
const SpotPosition_1 = __importDefault(require("../models/SpotPosition"));
const FuturesAccount_1 = require("../models/FuturesAccount");
const FuturesPosition_1 = require("../models/FuturesPosition");
const priceService_1 = require("./priceService");
async function calculateTotalPortfolioUSD(userId) {
    const positions = await SpotPosition_1.default.find({ userId }).lean();
    let totalUSD = 0;
    for (const pos of positions) {
        const available = parseFloat(pos.available?.toString() ?? '0');
        const reserved = parseFloat(pos.reserved?.toString() ?? '0');
        const amount = available + reserved;
        if (['USDT', 'USDC'].includes(pos.asset)) {
            totalUSD += amount;
        }
        else {
            try {
                const price = await priceService_1.priceService.getPrice(`${pos.asset}USDT`);
                totalUSD += amount * price;
            }
            catch {
                // Fallback to 0 for unknown/failed prices
            }
        }
    }
    // 2. Add Futures Account Balances (Stablecoins)
    const futuresAccs = await FuturesAccount_1.FuturesAccount.find({ userId }).lean();
    for (const acc of futuresAccs) {
        totalUSD += (acc.available || 0) + (acc.reserved || 0);
    }
    // 3. Add Futures Positions (Equity = Margin + Unrealized PnL)
    const futuresPositions = await FuturesPosition_1.FuturesPosition.find({ userId }).lean();
    for (const pos of futuresPositions) {
        totalUSD += (pos.margin || 0);
        try {
            const currentPrice = await priceService_1.priceService.getPrice(pos.symbol);
            const diff = pos.side === 'long'
                ? (currentPrice - pos.entryPrice)
                : (pos.entryPrice - currentPrice);
            const unrealizedPnL = pos.quantity * diff;
            totalUSD += unrealizedPnL;
        }
        catch {
            // If price fail, just count margin
        }
    }
    return Math.round(totalUSD * 100) / 100;
}
//# sourceMappingURL=portfolio.js.map