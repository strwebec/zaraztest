const mongoose = require('mongoose');

const ROLES = ['CLIENT', 'BUSINESS_OWNER', 'MODERATOR', 'FINANCE_ADMIN', 'ADMIN', 'SUPER_ADMIN'];

// Only meaningful for role: 'ADMIN' — a super-admin picks a subset of these when
// creating the account, and route access is checked against them (see
// routes/admin.js's PERMISSION_BUCKETS/requirePermission). MODERATOR/FINANCE_ADMIN
// keep their existing fixed bundles instead of using this field.
const PERMISSION_BUCKETS = ['businesses', 'reviews', 'categories', 'topPlacements', 'users', 'finance', 'support'];

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

    passwordResetToken: String,
    passwordResetExpires: Date,

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

    // Per-account lockout, independent of the IP-keyed login rate limiter — an
    // attacker spraying wrong passwords for one specific account from many
    // different IPs would otherwise never trip any per-IP limit at all.
    failedLoginAttempts: { type: Number, default: 0 },
    loginLockedUntil: Date,

    permissions: { type: [String], enum: PERMISSION_BUCKETS, default: undefined },

    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business' },
    favoriteBusinesses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Business' }],
    termsAcceptedAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;
module.exports.PERMISSION_BUCKETS = PERMISSION_BUCKETS;
