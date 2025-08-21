import mongoose, { Schema, Document, Model } from "mongoose";

export interface UserDocument extends Document {
  email: string;
  passwordHash: string;
  addressGroupId?: mongoose.Types.ObjectId | null;
  balances: {
    USDT: string; // decimal stored as string
    USDC: string; // decimal stored as string
  };
  refreshTokenVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<UserDocument>(
  {
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    addressGroupId: { type: Schema.Types.ObjectId, ref: "AddressGroup", default: null },
    balances: {
      USDT: { type: String, default: "0" },
      USDC: { type: String, default: "0" },
    },
    refreshTokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const User: Model<UserDocument> =
  mongoose.models.User || mongoose.model<UserDocument>("User", UserSchema);


