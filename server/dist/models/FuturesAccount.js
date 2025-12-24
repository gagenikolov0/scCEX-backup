"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FuturesAccount = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const FuturesAccountSchema = new mongoose_1.default.Schema({
    userId: { type: String, required: true, index: true },
    asset: { type: String, required: true }, // USDT or USDC
    available: { type: Number, default: 0 },
    reserved: { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now }
});
// Ensure only one account per user/asset
FuturesAccountSchema.index({ userId: 1, asset: 1 }, { unique: true });
exports.FuturesAccount = mongoose_1.default.model('FuturesAccount', FuturesAccountSchema);
//# sourceMappingURL=FuturesAccount.js.map