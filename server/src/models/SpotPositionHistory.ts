import mongoose, { Schema, Document } from 'mongoose';

export interface ISpotPositionHistory extends Document {
    userId: string;
    symbol: string;
    side: 'buy' | 'sell';
    price: number;
    quantity: number;
    total: number;
    closedAt: Date;
}

const SpotPositionHistorySchema: Schema = new Schema({
    userId: { type: String, required: true, index: true },
    symbol: { type: String, required: true, index: true },
    side: { type: String, enum: ['buy', 'sell'], required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true },
    total: { type: Number, required: true },
    closedAt: { type: Date, default: Date.now }
});

// Composite index for fast history lookups
SpotPositionHistorySchema.index({ userId: 1, closedAt: -1 });

export const SpotPositionHistory = mongoose.model<ISpotPositionHistory>('SpotPositionHistory', SpotPositionHistorySchema);
