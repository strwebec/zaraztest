const mongoose = require('mongoose');

const ROLES = ['CLIENT', 'BUSINESS_OWNER', 'MODERATOR', 'FINANCE_ADMIN', 'SUPER_ADMIN'];

const userSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ROLES, required: true, default: 'CLIENT' },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    avatarUrl: String,
    passwordHash: { type: String, required: true },
    city: { type: mongoose.Schema.Types.ObjectId, ref: 'City' },
    language: { type: String, enum: ['uk', 'en'], default: 'uk' },
    themePref: { type: String, enum: ['dark', 'light'], default: 'dark' },

    emailVerified: { type: Boolean, default: false },
    emailVerifyToken: String,
    emailVerifyExpires: Date,

    refreshTokens: [
      {
        token: String,
        expiresAt: Date,
        createdAt: { type: Date, default: Date.now },
      },
    ],

    rating: { type: Number, default: 5.0 },
    blockedUntil: Date,
    blockReason: String,
    consecutiveViolations: { type: Number, default: 0 },
    underReview: { type: Boolean, default: false },

    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business' },
    favoriteBusinesses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Business' }],
    termsAcceptedAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;
