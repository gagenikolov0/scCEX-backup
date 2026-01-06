import mongoose, { Schema, Document, Model } from "mongoose"

export interface UserDocument extends Document {
  email: string
  passwordHash: string
  username: string
  referralCode: string
  profilePicture?: string | null
  addressGroupId?: mongoose.Types.ObjectId | null
  refreshTokenVersion: number
  lastUsernameChange?: Date | null
  lastPfpChange?: Date | null
  createdAt: Date
  updatedAt: Date
}

const UserSchema = new Schema<UserDocument>(
  {
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    referralCode: { type: String, required: true, unique: true },
    profilePicture: { type: String, default: null },
    addressGroupId: { type: Schema.Types.ObjectId, ref: "AddressGroup", default: null },
    refreshTokenVersion: { type: Number, default: 0 },
    lastUsernameChange: { type: Date, default: null },
    lastPfpChange: { type: Date, default: null },
  },
  { timestamps: true }
)

export const User: Model<UserDocument> =
  mongoose.models.User || mongoose.model<UserDocument>("User", UserSchema)


