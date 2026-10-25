import mongoose from 'mongoose';

// One document per finished portfolio analysis (powers the History tab + chart).
const analysisSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  createdAt: { type: Date, default: Date.now, index: true },
  results: { type: mongoose.Schema.Types.Mixed, required: true },
  summary: {
    score: Number, // -100 (all bearish) .. +100 (all bullish), quantity-weighted
    bullish: Number,
    neutral: Number,
    bearish: Number,
    stocks: Number,
    totalQuantity: Number,
    symbols: [String],
  },
});

const Analysis = mongoose.model('Analysis', analysisSchema);
export default Analysis;