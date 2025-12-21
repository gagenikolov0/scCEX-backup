import SpotPosition from '../models/SpotPosition';
import { FuturesAccount } from '../models/FuturesAccount';
import { emitAccountEvent } from '../ws/streams/account';

/**
 * Emits full stablecoin balance (USDT & USDC) to the user.
 * This fixes the "zero-out" bug by always fetching both from the database.
 */
export async function syncStableBalances(userId: string) {
    try {
        const usdtPos = await SpotPosition.findOne({ userId, asset: 'USDT' }).lean();
        const usdcPos = await SpotPosition.findOne({ userId, asset: 'USDC' }).lean();

        emitAccountEvent(userId, {
            kind: 'balance',
            spotAvailable: {
                USDT: usdtPos?.available ?? '0',
                USDC: usdcPos?.available ?? '0'
            }
        });
    } catch (e) {
        console.error('Error syncing stable balances:', e);
    }
}

/**
 * Emits full futures balance (USDT & USDC) to the user.
 */
export async function syncFuturesBalances(userId: string) {
    try {
        const usdtAcc = await FuturesAccount.findOne({ userId, asset: 'USDT' }).lean();
        const usdcAcc = await FuturesAccount.findOne({ userId, asset: 'USDC' }).lean();

        emitAccountEvent(userId, {
            kind: 'futuresBalance',
            futuresAvailable: {
                USDT: (usdtAcc?.available || 0).toString(),
                USDC: (usdcAcc?.available || 0).toString()
            }
        });
    } catch (e) {
        console.error('Error syncing futures balances:', e);
    }
}

/**
 * Emits updated position (including reserved) to the user.
 */
export async function syncPosition(userId: string, asset: string) {
    if (['USDT', 'USDC'].includes(asset)) {
        return syncStableBalances(userId);
    }

    try {
        const pos = await SpotPosition.findOne({ userId, asset }).lean();
        if (pos) {
            emitAccountEvent(userId, {
                kind: 'position',
                asset: pos.asset,
                available: pos.available?.toString() ?? '0',
                reserved: pos.reserved?.toString() ?? '0'
            });
        }
    } catch (e) {
        console.error(`Error syncing position for ${asset}:`, e);
    }
}

/**
 * Emits order update.
 */
export function syncOrder(userId: string, order: any) {
    emitAccountEvent(userId, { kind: 'order', order });
}
