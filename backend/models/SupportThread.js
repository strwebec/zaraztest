const mongoose = require('mongoose');

// One thread per user — a simple 1:1 support conversation rather than
// multi-topic ticketing, matching the "any user can write, any admin/
// moderator can answer" scope this was built for.
const supportThreadSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    userRole: { type: String, required: true },
    userName: { type: String, required: true },
    userEmail: { type: String, required: true },
    lastMessageAt: { type: Date, default: Date.now },
    lastMessagePreview: { type: String, default: '' },
    lastMessageFrom: { type: String, enum: ['user', 'admin'] },
    unreadByAdmin: { type: Number, default: 0 },
    unreadByUser: { type: Number, default: 0 },
    // ACTIVE covers both "awaiting admin reply" and "admin replied, open" —
    // the admin inbox derives that split from lastMessageFrom instead of
    // storing it, so this only tracks the explicit resolve/reopen action.
    status: { type: String, enum: ['ACTIVE', 'COMPLETED'], default: 'ACTIVE' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SupportThread', supportThreadSchema);
