import mongoose, { Document } from 'mongoose';
export interface IFuturesPositionHistory extends Document {
    userId: string;
    symbol: string;
    side: 'long' | 'short';
    entryPrice: number;
    exitPrice: number;
    quantity: number;
    leverage: number;
    margin: number;
    realizedPnL: number;
    closedAt: Date;
    note?: string;
}
export declare const FuturesPositionHistory: mongoose.Model<IFuturesPositionHistory, {}, {}, {}, mongoose.Document<unknown, {}, IFuturesPositionHistory, {}, {}> & IFuturesPositionHistory & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=FuturesPositionHistory.d.ts.map