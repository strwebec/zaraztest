const AdminAuditLog = require('../models/AdminAuditLog');
const { notify } = require('../utils/telegramNotifier');

// Security Agent v1a — observation only, no auto-anything (see
// .claude/plans/tidy-tickling-wilkinson.md). Plain field matching against a
// fixed list, deliberately not an LLM call: these actions are either
// destructive (delete) or change who has admin access at all (team.*), so a
// false negative from a misbehaving model is a worse failure mode here than
// a plain, predictable allowlist.
const SENSITIVE_ACTIONS = [
  'team.invite',
  'team.remove',
  'team.resetCredentials',
  'user.delete',
  'business.delete',
  'category.delete',
  'city.delete',
];

// In-memory cursor — same tradeoff as confirmationStore.js: a Render restart
// resets this to "now", so anything that happened during the restart window
// is silently skipped rather than replayed. Acceptable for v1 alerting.
let lastCheckedAt = new Date();

async function runAuditLogWatch() {
  const since = lastCheckedAt;
  lastCheckedAt = new Date();

  const entries = await AdminAuditLog.find({
    action: { $in: SENSITIVE_ACTIONS },
    createdAt: { $gt: since },
  })
    .sort({ createdAt: 1 })
    .lean();

  for (const entry of entries) {
    const text = [
      'Security Agent: чутлива адмін-дія',
      `Дія: ${entry.action}`,
      `Виконав: ${entry.adminRole || '?'} (${entry.admin})`,
      entry.targetLabel ? `Ціль: ${entry.targetLabel}` : null,
      `Час: ${entry.createdAt.toISOString()}`,
    ]
      .filter(Boolean)
      .join('\n');
    await notify(text);
  }
}

module.exports = { runAuditLogWatch };
