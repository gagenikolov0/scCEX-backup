import mongoose, { Document, Model } from "mongoose";
export interface UserDocument extends Document {
    email: string;
    passwordHash: string;
    depositAddressId?: mongoose.Types.ObjectId | null;
    balances: {
        USDT: string;
        USDC: string;
    };
    refreshTokenVersion: number;
    createdAt: Date;
    updatedAt: Date;
}
export declare const User: Model<UserDocument>;
//# sourceMappingURL=User.d.ts.map