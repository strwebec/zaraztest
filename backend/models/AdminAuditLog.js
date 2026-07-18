const mongoose = require('mongoose');

const adminAuditLogSchema = new mongoose.Schema(
  {
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    adminRole: String,
    action: { type: String, required: true }, // e.g. 'business.block', 'user.delete'
    targetType: String, // 'Business' | 'User' | 'TopPlacement' | 'Invoice' | 'Category' | 'Review'
    targetId: mongoose.Schema.Types.ObjectId,
    targetLabel: String, // human-readable snapshot (name/email) in case the target is later deleted
    meta: mongoose.Schema.Types.Mixed,
    ip: String,
    userAgent: String,
  },
  { timestamps: true }
);

adminAuditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AdminAuditLog', adminAuditLogSchema);
