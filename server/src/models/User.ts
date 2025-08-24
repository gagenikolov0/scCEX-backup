import mongoose, { Schema, Document, Model } from "mongoose";

export interface UserDocument extends Document {
  email: string;
  passwordHash: string;
  addressGroupId?: mongoose.Types.ObjectId | null;
  // Unified asset system - all assets (including USDT/USDC) are handled via SpotPosition
  refreshTokenVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<UserDocument>(
  {
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    addressGroupId: { type: Schema.Types.ObjectId, ref: "AddressGroup", default: null },
    refreshTokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const User: Model<UserDocument> =
  mongoose.models.User || mongoose.model<UserDocument>("User", UserSchema);


