import mongoose, { Document, Model } from "mongoose";
export interface AddressGroupDocument extends Document {
    ethAddress?: string | null;
    tronAddress?: string | null;
    bscAddress?: string | null;
    solAddress?: string | null;
    xrpAddress?: string | null;
    assignedTo?: mongoose.Types.ObjectId | null;
    createdAt: Date;
    updatedAt: Date;
}
export declare const AddressGroup: Model<AddressGroupDocument>;
//# sourceMappingURL=AddressGroup.d.ts.map