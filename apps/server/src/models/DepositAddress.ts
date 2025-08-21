import mongoose, { Schema, Document, Model } from "mongoose";

export interface DepositAddressDocument extends Document {
  address: string;
  asset: "USDT" | "USDC";
  chain: string; // e.g., TRON, ETH, SOL
  assignedTo?: mongoose.Types.ObjectId | null;
  assignedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const DepositAddressSchema = new Schema<DepositAddressDocument>(
  {
    address: { type: String, required: true, unique: true },
    asset: { type: String, enum: ["USDT", "USDC"], required: true },
    chain: { type: String, required: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null },
    assignedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "deposit_addresses" }
);

export const DepositAddress: Model<DepositAddressDocument> =
  mongoose.models.DepositAddress ||
  mongoose.model<DepositAddressDocument>("DepositAddress", DepositAddressSchema);


