import mongoose, { Document, Model } from "mongoose";
export interface DepositAddressDocument extends Document {
    address: string;
    asset: "USDT" | "USDC";
    chain: string;
    assignedTo?: mongoose.Types.ObjectId | null;
    assignedAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
}
export declare const DepositAddress: Model<DepositAddressDocument>;
//# sourceMappingURL=DepositAddress.d.ts.map