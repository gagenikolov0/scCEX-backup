import mongoose, { Document, Model } from "mongoose";
export interface UserDocument extends Document {
    email: string;
    passwordHash: string;
    addressGroupId?: mongoose.Types.ObjectId | null;
    refreshTokenVersion: number;
    createdAt: Date;
    updatedAt: Date;
}
export declare const User: Model<UserDocument>;
//# sourceMappingURL=User.d.ts.map