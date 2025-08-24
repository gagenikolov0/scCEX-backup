import mongoose, { Schema, Document, Model } from "mongoose";

export interface UserDocument extends Document {
  email: string;
  passwordHash: string;
  addressGroupId?: mongoose.Types.ObjectId | null;
  // Flat wallet fields for spot/futures and USDT/USDC
  spotAvailableUSDT: mongoose.Types.Decimal128;
  spotTotalUSDT: mongoose.Types.Decimal128;
  spotAvailableUSDC: mongoose.Types.Decimal128;
  spotTotalUSDC: mongoose.Types.Decimal128;
  futuresAvailableUSDT: mongoose.Types.Decimal128;
  futuresTotalUSDT: mongoose.Types.Decimal128;
  futuresAvailableUSDC: mongoose.Types.Decimal128;
  futuresTotalUSDC: mongoose.Types.Decimal128;
  refreshTokenVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<UserDocument>(
  {
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    addressGroupId: { type: Schema.Types.ObjectId, ref: "AddressGroup", default: null },
    spotAvailableUSDT: { type: Schema.Types.Decimal128, default: () => mongoose.Types.Decimal128.fromString("0") },
    spotTotalUSDT: { type: Schema.Types.Decimal128, default: () => mongoose.Types.Decimal128.fromString("0") },
    spotAvailableUSDC: { type: Schema.Types.Decimal128, default: () => mongoose.Types.Decimal128.fromString("0") },
    spotTotalUSDC: { type: Schema.Types.Decimal128, default: () => mongoose.Types.Decimal128.fromString("0") },
    futuresAvailableUSDT: { type: Schema.Types.Decimal128, default: () => mongoose.Types.Decimal128.fromString("0") },
    futuresTotalUSDT: { type: Schema.Types.Decimal128, default: () => mongoose.Types.Decimal128.fromString("0") },
    futuresAvailableUSDC: { type: Schema.Types.Decimal128, default: () => mongoose.Types.Decimal128.fromString("0") },
    futuresTotalUSDC: { type: Schema.Types.Decimal128, default: () => mongoose.Types.Decimal128.fromString("0") },
    refreshTokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const User: Model<UserDocument> =
  mongoose.models.User || mongoose.model<UserDocument>("User", UserSchema);


