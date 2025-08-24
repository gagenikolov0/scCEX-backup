import mongoose, { Schema, Document, Model } from "mongoose";

export interface SpotPositionDocument extends Document {
  userId: string;
  asset: string; // base asset, e.g., BTC, USDT, USDC
  available: string;  // Available for trading (e.g., "0.1" BTC, "5000" USDT)
  createdAt: Date;
  updatedAt: Date;
}

const SpotPositionSchema = new Schema<SpotPositionDocument>(
  {
    userId: { type: String, required: true, index: true },
    asset: { type: String, required: true },
    available: { type: String, default: "0" },  // Available for trading
  },
  { timestamps: true }
);

SpotPositionSchema.index({ userId: 1, asset: 1 }, { unique: true });

export const SpotPosition: Model<SpotPositionDocument> =
  mongoose.models.SpotPosition || mongoose.model<SpotPositionDocument>("SpotPosition", SpotPositionSchema);


