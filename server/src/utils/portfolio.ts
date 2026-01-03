import SpotPosition from '../models/SpotPosition';
import { FuturesAccount } from '../models/FuturesAccount';
import { FuturesPosition } from '../models/FuturesPosition';
import { priceService } from './priceService';

export async function calculateTotalPortfolioUSD(userId: string): Promise<number> {
    const positions = await SpotPosition.find({ userId }).lean();
    let totalUSD = 0;

    for (const pos of positions) {
        const available = parseFloat(pos.available?.toString() ?? '0');
        const reserved = parseFloat(pos.reserved?.toString() ?? '0');
        const amount = available + reserved;

        if (['USDT', 'USDC'].includes(pos.asset)) {
            totalUSD += amount;
        } else {
            try {
                const price = await priceService.getPrice(`${pos.asset}USDT`);
                totalUSD += amount * price;
            } catch {
                // Fallback to 0 for unknown/failed prices
            }
        }
    }

    // 2. Add Futures Account Balances (Stablecoins)
    const futuresAccs = await FuturesAccount.find({ userId }).lean();
    for (const acc of futuresAccs) {
        totalUSD += (acc.available || 0) + (acc.reserved || 0);
    }

    // 3. Add Futures Positions (Equity = Margin + Unrealized PnL)
    const futuresPositions = await FuturesPosition.find({ userId }).lean();
    for (const pos of futuresPositions) {
        totalUSD += (pos.margin || 0);
        try {
            // Strictly normalize for futures pricing
            const sym = pos.symbol.includes('_') ? pos.symbol : pos.symbol.replace(/(USDT|USDC)$/i, '_$1');
            const currentPrice = await priceService.getPrice(sym);
            const diff = pos.side === 'long'
                ? (currentPrice - pos.entryPrice)
                : (pos.entryPrice - currentPrice);
            const unrealizedPnL = pos.quantity * diff;
            totalUSD += unrealizedPnL;
        } catch {
            // If price fail, just count margin
        }
    }

    return Math.round(totalUSD * 100) / 100;
}
