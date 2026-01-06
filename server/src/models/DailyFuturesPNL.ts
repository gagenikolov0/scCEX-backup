import mongoose, { Schema, Document, Model } from "mongoose"

export interface DailyFuturesPNLDocument extends Document {
    userId: mongoose.Types.ObjectId
    date: Date // Midnight UTC
    futuresEquity: number // Balance + Unrealized PnL at end of day
    pnlAmount: number // Net profit/loss for the day in USD
    roi: number // Percentage return relative to starting equity
    netTransfers: number // Net inflow/outflow for the day
    createdAt: Date
}

const DailyFuturesPNLSchema = new Schema<DailyFuturesPNLDocument>(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        date: { type: Date, required: true, index: true },
        futuresEquity: { type: Number, required: true },
        pnlAmount: { type: Number, required: true },
        roi: { type: Number, required: true },
        netTransfers: { type: Number, default: 0 },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
)

// Ensure uniqueness of (userId, date)
DailyFuturesPNLSchema.index({ userId: 1, date: 1 }, { unique: true })

export const DailyFuturesPNL: Model<DailyFuturesPNLDocument> =
    mongoose.models.DailyFuturesPNL || mongoose.model<DailyFuturesPNLDocument>("DailyFuturesPNL", DailyFuturesPNLSchema)
