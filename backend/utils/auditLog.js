const AdminAuditLog = require('../models/AdminAuditLog');

// Fire-and-forget: a logging failure should never break the actual admin action.
async function logAdminAction(req, { action, targetType, targetId, targetLabel, meta }) {
  try {
    await AdminAuditLog.create({
      admin: req.userId,
      adminRole: req.userRole,
      action,
      targetType,
      targetId,
      targetLabel,
      meta,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  } catch (err) {
    console.error('[auditLog] failed to record action', action, err.message);
  }
}

module.exports = { logAdminAction };
