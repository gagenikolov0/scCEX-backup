import SpotPosition from '../models/SpotPosition';
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

    return Math.round(totalUSD * 100) / 100;
}
