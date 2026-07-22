const User = require('../../models/User');
const AdminAuditLog = require('../../models/AdminAuditLog');
const { formatNumberedList } = require('../messageFormatting');

// Observation/alerting only in v1 — no actions, so no executeConfirmed (see
// .claude/plans/tidy-tickling-wilkinson.md's Phase 6-8 scoping). These
// queries hit the database directly rather than going through serviceAuth's
// admin-API round-trip, since jobs/auditLogWatch.js (running in the same
// process) already does the same for its own polling — no new access path,
// just direct model reads.
async function handleCommand(chatId, text) {
  const normalized = text.trim().toLowerCase();

  if (/^(заблоковані( акаунти)?|locked accounts?)$/.test(normalized)) {
    const count = await User.countDocuments({ loginLockedUntil: { $gt: new Date() } });
    return `Заблокованих акаунтів (login lockout) зараз: ${count}`;
  }

  if (/^(аудит|останні дії|audit)$/.test(normalized)) {
    const entries = await AdminAuditLog.find({}).sort({ createdAt: -1 }).limit(10).lean();
    if (!entries.length) return 'Немає записів в AdminAuditLog.';
    const lines = entries.map((e) => `${e.action} — ${e.targetLabel || e.targetId || ''} (${e.createdAt.toISOString()})`);
    return `Останні 10 адмін-дій:\n${formatNumberedList(lines)}`;
  }

  return null;
}

const HELP_TEXT = [
  'Команди Security Agent:',
  '"заблоковані акаунти" — скільки акаунтів зараз заблоковано через login lockout',
  '"аудит" — останні 10 адмін-дій з AdminAuditLog',
].join('\n');

module.exports = { handleCommand, HELP_TEXT };
