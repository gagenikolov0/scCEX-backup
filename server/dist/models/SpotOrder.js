"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpotOrder = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const SpotOrderSchema = new mongoose_1.Schema({
    userId: { type: String, required: true, index: true },
    symbol: { type: String, required: true, index: true },
    baseAsset: { type: String, required: true },
    quoteAsset: { type: String, required: true, enum: ["USDT", "USDC"] },
    side: { type: String, required: true, enum: ["buy", "sell"] },
    quantityBase: { type: mongoose_1.Schema.Types.Decimal128, required: true },
    priceQuote: { type: mongoose_1.Schema.Types.Decimal128, required: true },
    quoteAmount: { type: mongoose_1.Schema.Types.Decimal128, required: true },
    status: { type: String, required: true, enum: ["filled", "rejected", "pending"], index: true },
}, { timestamps: true });
SpotOrderSchema.index({ userId: 1, createdAt: -1 });
exports.SpotOrder = mongoose_1.default.models.SpotOrder || mongoose_1.default.model("SpotOrder", SpotOrderSchema);
//# sourceMappingURL=SpotOrder.js.map