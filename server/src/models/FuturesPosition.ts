import mongoose from 'mongoose';

const FuturesPositionSchema = new mongoose.Schema({
    userId: { type: String, required: true, index: true },
    symbol: { type: String, required: true, index: true },
    side: { type: String, enum: ['long', 'short'], required: true },
    entryPrice: { type: Number, required: true },
    quantity: { type: Number, required: true }, // Size in contracts/base
    leverage: { type: Number, required: true },
    margin: { type: Number, required: true },
    liquidationPrice: { type: Number },
    updatedAt: { type: Date, default: Date.now }
});

export const FuturesPosition = mongoose.model('FuturesPosition', FuturesPositionSchema);
