import mongoose, { Document, Model } from "mongoose";
export type SpotOrderSide = "buy" | "sell";
export type SpotOrderStatus = "filled" | "rejected" | "pending";
export interface SpotOrderDocument extends Document {
    userId: string;
    symbol: string;
    baseAsset: string;
    quoteAsset: "USDT" | "USDC";
    side: SpotOrderSide;
    quantityBase: mongoose.Types.Decimal128;
    priceQuote: mongoose.Types.Decimal128;
    quoteAmount: mongoose.Types.Decimal128;
    status: SpotOrderStatus;
    createdAt: Date;
    updatedAt: Date;
}
export declare const SpotOrder: Model<SpotOrderDocument>;
//# sourceMappingURL=SpotOrder.d.ts.map