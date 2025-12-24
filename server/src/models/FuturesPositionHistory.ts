import mongoose, { Schema, Document } from 'mongoose';

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

const FuturesPositionHistorySchema: Schema = new Schema({
    userId: { type: String, required: true, index: true },
    symbol: { type: String, required: true },
    side: { type: String, enum: ['long', 'short'], required: true },
    entryPrice: { type: Number, required: true },
    exitPrice: { type: Number, required: true },
    quantity: { type: Number, required: true },
    leverage: { type: Number, required: true },
    margin: { type: Number, required: true },
    realizedPnL: { type: Number, required: true },
    closedAt: { type: Date, default: Date.now },
    note: { type: String }
});

export const FuturesPositionHistory = mongoose.model<IFuturesPositionHistory>('FuturesPositionHistory', FuturesPositionHistorySchema);
