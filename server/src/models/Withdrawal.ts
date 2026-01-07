import mongoose, { Schema, Document } from 'mongoose'

export interface IWithdrawal extends Document {
    userId: mongoose.Types.ObjectId
    asset: string
    network: string
    address: string
    amount: number
    fee: number
    status: 'pending' | 'processing' | 'completed' | 'failed'
    txHash?: string
    createdAt: Date
}

const withdrawalSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    asset: { type: String, required: true },
    network: { type: String, required: true },
    address: { type: String, required: true },
    amount: { type: Number, required: true },
    fee: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
    txHash: { type: String },
    createdAt: { type: Date, default: Date.now }
})

export const Withdrawal = mongoose.model<IWithdrawal>('Withdrawal', withdrawalSchema)
