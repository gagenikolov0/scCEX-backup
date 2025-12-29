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
exports.FuturesPositionHistory = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const FuturesPositionHistorySchema = new mongoose_1.Schema({
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
exports.FuturesPositionHistory = mongoose_1.default.model('FuturesPositionHistory', FuturesPositionHistorySchema);
//# sourceMappingURL=FuturesPositionHistory.js.map