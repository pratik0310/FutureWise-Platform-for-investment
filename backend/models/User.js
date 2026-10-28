import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const holdingSchema = new mongoose.Schema(
  {
    symbol: { type: String, required: true },
    name: String,
    quantity: { type: Number, default: 0 },
  },
  { _id: false, strict: false } // strict:false keeps extra fields React send (price, etc.)
);

const userSchema = new mongoose.Schema({
  googleId: { type: String, unique: true, sparse: true },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  // Only set for email/password accounts. Not loaded unless you ask
  // for it with .select('+password'), and never sent to the frontend.
  password: { type: String, select: false },
  displayName: String,
  photo: String,

  // NEW: WhatsApp notifications. Digits only, with country code, no "+".
  phone: { type: String, trim: true, default: '' },
  whatsappOptIn: { type: Boolean, default: false },

  portfolio: { type: [holdingSchema], default: [] },
  lastAnalysis: { type: mongoose.Schema.Types.Mixed, default: null },
  lastAnalysisAt: Date,
  createdAt: { type: Date, default: Date.now },
});

// Hash the password whenever it is set or changed.
userSchema.pre('save', async function () {
  if (!this.isModified('password') || !this.password) return;
  this.password = await bcrypt.hash(this.password, 12);
});

// Compare a typed password with the stored hash.
userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

// Never include the password hash when a user is sent as JSON.
userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.password;
    return ret;
  },
});

const User = mongoose.model('User', userSchema);
export default User;