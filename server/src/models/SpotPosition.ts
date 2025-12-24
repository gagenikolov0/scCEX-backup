import mongoose from 'mongoose'

const spotPositionSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  asset: { type: String, required: true },
  available: { type: Number, default: 0 },
  reserved: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true })

spotPositionSchema.index({ userId: 1, asset: 1 }, { unique: true })

export default mongoose.model('SpotPosition', spotPositionSchema)
