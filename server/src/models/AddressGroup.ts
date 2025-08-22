import mongoose, { Schema, Document, Model } from "mongoose";

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

const AddressGroupSchema = new Schema<AddressGroupDocument>(
  {
    ethAddress: { type: String, default: null },
    tronAddress: { type: String, default: null },
    bscAddress: { type: String, default: null },
    solAddress: { type: String, default: null },
    xrpAddress: { type: String, default: null },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "address_groups" }
);

export const AddressGroup: Model<AddressGroupDocument> =
  mongoose.models.AddressGroup ||
  mongoose.model<AddressGroupDocument>("AddressGroup", AddressGroupSchema);


