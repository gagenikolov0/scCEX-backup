import mongoose, { Schema, Document, Model } from "mongoose"

export interface FuturesActivityDocument extends Document {
    userId: mongoose.Types.ObjectId
    type: 'TRANSFER_IN' | 'TRANSFER_OUT'
    asset: string // 'USDT' or 'USDC'
    amount: number
    createdAt: Date
}

const FuturesActivitySchema = new Schema<FuturesActivityDocument>(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        type: { type: String, enum: ['TRANSFER_IN', 'TRANSFER_OUT'], required: true },
        asset: { type: String, required: true },
        amount: { type: Number, required: true },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
)

export const FuturesActivity: Model<FuturesActivityDocument> =
    mongoose.models.FuturesActivity || mongoose.model<FuturesActivityDocument>("FuturesActivity", FuturesActivitySchema)
