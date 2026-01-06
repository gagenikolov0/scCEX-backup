import { FuturesAccount } from '../models/FuturesAccount';
import { FuturesPosition } from '../models/FuturesPosition';
import { FuturesActivity } from '../models/FuturesActivity';
import { DailyFuturesPNL } from '../models/DailyFuturesPNL';
import { calculateFuturesEquity } from './portfolio';

export class FuturesPnlService {
    /**
     * Calculates the total value of a user's futures account.
     * Uses the shared utility for consistency.
     */
    async getEquity(userId: string): Promise<number> {
        return calculateFuturesEquity(userId);
    }

    /**
     * Captures a daily snapshot for all active users.
     */
    async takeDailySnapshots() {
        console.log('[PNL Service] Starting daily snapshots...');
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);

        const yesterday = new Date(today);
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);

        const distinctUserIds = await FuturesAccount.distinct('userId');

        for (const userId of distinctUserIds) {
            try {
                const currentEquity = await this.getEquity(String(userId));

                // Get yesterday's snapshot
                const lastSnapshot = await DailyFuturesPNL.findOne({
                    userId,
                    date: { $lt: today }
                }).sort({ date: -1 }).lean();

                // Get activity SINCE the last snapshot or yesterday
                const activityQuery: any = { userId };
                if (lastSnapshot) {
                    activityQuery.createdAt = { $gte: lastSnapshot.createdAt };
                } else {
                    activityQuery.createdAt = { $gte: yesterday };
                }

                const activities = await FuturesActivity.find(activityQuery).lean();

                let netTransfers = 0;
                for (const act of activities) {
                    if (act.type === 'TRANSFER_IN') netTransfers += act.amount;
                    else netTransfers -= act.amount;
                }

                const startEquity = lastSnapshot?.futuresEquity || 0;
                const pnlAmount = currentEquity - startEquity - netTransfers;
                const roiBasis = lastSnapshot ? lastSnapshot.futuresEquity : netTransfers;
                const roi = roiBasis > 0 ? (pnlAmount / roiBasis) * 100 : 0;

                await DailyFuturesPNL.findOneAndUpdate(
                    { userId, date: today },
                    {
                        futuresEquity: currentEquity,
                        pnlAmount: Math.round(pnlAmount * 100) / 100,
                        roi: Math.round(roi * 100) / 100,
                        netTransfers: Math.round(netTransfers * 100) / 100
                    },
                    { upsert: true, new: true }
                );
            } catch (err) {
                console.error(`[PNL Service] Error for user ${userId}:`, err);
            }
        }
        console.log('[PNL Service] Daily snapshots completed.');
    }

    /**
     * Retrieves historical PNL data for the calendar.
     */
    async getHistoricalPNL(userId: string, limitDays: number = 180) {
        return DailyFuturesPNL.find({ userId })
            .sort({ date: -1 })
            .limit(limitDays)
            .lean();
    }

    /**
     * Calculates real-time 24h PNL for WebSocket broadcast.
     */
    async calculateRealTimePNL(userId: string) {
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);

        const currentEquity = await this.getEquity(userId);

        const lastSnapshot = await DailyFuturesPNL.findOne({
            userId,
            date: { $lt: today }
        }).sort({ date: -1 }).lean();

        // Baseline logic for transfers
        const activityQuery: any = { userId };
        if (lastSnapshot) {
            activityQuery.createdAt = { $gte: today };
        }

        const activities = await FuturesActivity.find(activityQuery).lean();

        let netTransfers = 0;
        for (const act of activities) {
            if (act.type === 'TRANSFER_IN') netTransfers += act.amount;
            else netTransfers -= act.amount;
        }

        const startEquity = lastSnapshot?.futuresEquity || 0;
        const pnlAmount = currentEquity - startEquity - netTransfers;

        const roiBasis = lastSnapshot ? lastSnapshot.futuresEquity : netTransfers;
        const roi = roiBasis > 0 ? (pnlAmount / roiBasis) * 100 : 0;

        return {
            equity: currentEquity,
            pnl: Math.round(pnlAmount * 100) / 100,
            roi: Math.round(roi * 100) / 100
        };
    }
}

export const futuresPnlService = new FuturesPnlService();
