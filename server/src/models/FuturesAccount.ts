import mongoose from 'mongoose';

const FuturesAccountSchema = new mongoose.Schema({
    userId: { type: String, required: true, index: true },
    asset: { type: String, required: true }, // USDT or USDC
    available: { type: Number, default: 0 },
    reserved: { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now }
});

// Ensure only one account per user/asset
FuturesAccountSchema.index({ userId: 1, asset: 1 }, { unique: true });

export const FuturesAccount = mongoose.model('FuturesAccount', FuturesAccountSchema);
