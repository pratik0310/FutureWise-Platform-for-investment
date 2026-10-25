import mongoose from 'mongoose';

// One document per price alert. Active until it fires once, then "triggered".
const alertSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  symbol: { type: String, required: true, uppercase: true, trim: true },
  name: String,
  exchange: { type: String, default: 'NSE' },
  direction: { type: String, enum: ['above', 'below'], required: true },
  targetPrice: { type: Number, required: true },
  status: { type: String, enum: ['active', 'triggered'], default: 'active', index: true },
  createdAt: { type: Date, default: Date.now },
  triggeredAt: Date,
  triggeredPrice: Number,
  currency: String,
});

const Alert = mongoose.model('Alert', alertSchema);
export default Alert;