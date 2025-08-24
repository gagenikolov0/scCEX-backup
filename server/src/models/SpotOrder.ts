import mongoose, { Schema, Document, Model } from "mongoose";

export type SpotOrderSide = "buy" | "sell";
export type SpotOrderStatus = "filled" | "rejected" | "pending";

export interface SpotOrderDocument extends Document {
  userId: string;  // Changed from mongoose.Types.ObjectId to string to match SpotPosition
  symbol: string; // e.g., BTCUSDT
  baseAsset: string; // e.g., BTC
  quoteAsset: "USDT" | "USDC";
  side: SpotOrderSide;
  quantityBase: mongoose.Types.Decimal128; // base asset quantity
  priceQuote: mongoose.Types.Decimal128; // price in quote asset
  quoteAmount: mongoose.Types.Decimal128; // executed amount in quote
  status: SpotOrderStatus;
  createdAt: Date;
  updatedAt: Date;
}

const SpotOrderSchema = new Schema<SpotOrderDocument>(
  {
    userId: { type: String, required: true, index: true },
    symbol: { type: String, required: true, index: true },
    baseAsset: { type: String, required: true },
    quoteAsset: { type: String, required: true, enum: ["USDT", "USDC"] },
    side: { type: String, required: true, enum: ["buy", "sell"] },
    quantityBase: { type: Schema.Types.Decimal128, required: true },
    priceQuote: { type: Schema.Types.Decimal128, required: true },
    quoteAmount: { type: Schema.Types.Decimal128, required: true },
    status: { type: String, required: true, enum: ["filled", "rejected", "pending"], index: true },
  },
  { timestamps: true }
);

SpotOrderSchema.index({ userId: 1, createdAt: -1 });

export const SpotOrder: Model<SpotOrderDocument> =
  mongoose.models.SpotOrder || mongoose.model<SpotOrderDocument>("SpotOrder", SpotOrderSchema);


