import mongoose from 'mongoose';

const FuturesOrderSchema = new mongoose.Schema({
    userId: { type: String, required: true, index: true },
    symbol: { type: String, required: true, index: true }, // e.g., BTC_USDT
    side: { type: String, enum: ['long', 'short'], required: true },
    type: { type: String, enum: ['limit', 'market'], required: true },
    status: { type: String, enum: ['pending', 'filled', 'cancelled', 'rejected'], default: 'pending' },
    price: { type: Number }, // Required for limit orders
    quantity: { type: Number, required: true }, // Size in USDT or base asset? Usually USDT for ease.
    leverage: { type: Number, default: 1 },
    marginMode: { type: String, enum: ['isolated', 'cross'], default: 'isolated' },
    executedQuantity: { type: Number, default: 0 },
    averagePrice: { type: Number, default: 0 },
    margin: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

export const FuturesOrder = mongoose.model('FuturesOrder', FuturesOrderSchema);
