"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FuturesPosition = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const FuturesPositionSchema = new mongoose_1.default.Schema({
    userId: { type: String, required: true, index: true },
    symbol: { type: String, required: true, index: true },
    side: { type: String, enum: ['long', 'short'], required: true },
    entryPrice: { type: Number, required: true },
    quantity: { type: Number, required: true }, // Size in contracts/base
    leverage: { type: Number, required: true },
    margin: { type: Number, required: true },
    liquidationPrice: { type: Number },
    tpPrice: { type: Number, default: 0 },
    tpQuantity: { type: Number, default: 0 }, // 0 means 100%
    slPrice: { type: Number, default: 0 },
    slQuantity: { type: Number, default: 0 }, // 0 means 100%
    realizedPnL: { type: Number, default: 0 }, // Cumulative realized profit/loss from partial closes
    updatedAt: { type: Date, default: Date.now }
});
exports.FuturesPosition = mongoose_1.default.model('FuturesPosition', FuturesPositionSchema);
//# sourceMappingURL=FuturesPosition.js.map