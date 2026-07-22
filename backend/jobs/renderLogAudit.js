const { notify } = require('../utils/telegramNotifier');

// Security Agent v1b — polls Render's Logs API on a schedule and applies
// fixed, conservative thresholds over Phase 0's structured request-log lines
// (backend/middleware/requestLogger.js). Deliberately no LLM in this
// detection path (see .claude/plans/tidy-tickling-wilkinson.md) — these are
// simple counting rules, and a model call here would trade a predictable
// check for a probabilistic one with no real benefit.
//
// Thresholds start conservative on purpose: the service has little real
// traffic yet, so there's no reliable baseline to tune against. Revisit once
// a few weeks of real traffic data exist.
const FOUR_OH_ONE_PER_IP_THRESHOLD = 15;
const FIVE_XX_THRESHOLD = 5;

// In-memory cursor, same tradeoff as confirmationStore.js/auditLogWatch.js —
// a Render restart resets this to "now", silently skipping whatever gap
// occurred during the restart.
let cursorStart = new Date(Date.now() - 10 * 60 * 1000).toISOString();

function isConfigured() {
  return !!(process.env.RENDER_API_KEY && process.env.RENDER_OWNER_ID && process.env.RENDER_SERVICE_ID);
}

// Fetches every log page in [startTime, endTime) — Render's List Logs API is
// timestamp-paginated (hasMore/nextStartTime/nextEndTime), not cursor-based.
async function fetchLogs(startTime, endTime) {
  const all = [];
  let cursor = { startTime, endTime };
  for (let page = 0; page < 20; page += 1) {
    const params = new URLSearchParams({
      ownerId: process.env.RENDER_OWNER_ID,
      startTime: cursor.startTime,
      endTime: cursor.endTime,
      direction: 'forward',
      limit: '100',
    });
    params.append('resource', process.env.RENDER_SERVICE_ID);
    params.append('type', 'app');

    const res = await fetch(`https://api.render.com/v1/logs?${params.toString()}`, {
      headers: { Authorization: `Bearer ${process.env.RENDER_API_KEY}` },
    });
    if (!res.ok) throw new Error(`Render Logs API ${res.status}: ${await res.text()}`);
    const data = await res.json();
    all.push(...data.logs);
    if (!data.hasMore) break;
    cursor = { startTime: data.nextStartTime, endTime: data.nextEndTime };
  }
  return all;
}

// Our own requestLogger lines are plain JSON text inside Render's `message`
// field (Render doesn't parse app stdout into its own labels) — anything
// that doesn't parse as one of those lines (startup banners, stack traces)
// is silently skipped rather than treated as an error.
function parseAppLogLines(logs) {
  const parsed = [];
  for (const entry of logs) {
    try {
      const line = JSON.parse(entry.message);
      if (line && typeof line.status === 'number') parsed.push(line);
    } catch {
      // not one of our structured lines — ignore
    }
  }
  return parsed;
}

async function runRenderLogAudit() {
  if (!isConfigured()) {
    console.log('[renderLogAudit] RENDER_API_KEY/RENDER_OWNER_ID/RENDER_SERVICE_ID not set — skipped');
    return;
  }

  const windowStart = cursorStart;
  const windowEnd = new Date().toISOString();
  cursorStart = windowEnd;

  let logs;
  try {
    logs = await fetchLogs(windowStart, windowEnd);
  } catch (err) {
    console.error('[renderLogAudit] fetch failed:', err.message);
    return;
  }

  const lines = parseAppLogLines(logs);

  const failedByIp = new Map();
  let fiveXxCount = 0;
  for (const line of lines) {
    if (line.status === 401) failedByIp.set(line.ip, (failedByIp.get(line.ip) || 0) + 1);
    if (line.status >= 500) fiveXxCount += 1;
  }

  for (const [ip, count] of failedByIp) {
    if (count >= FOUR_OH_ONE_PER_IP_THRESHOLD) {
      await notify(
        `Security Agent: підозріла активність\n${count} відповідей 401 з IP ${ip} за останні ~${Math.round(
          (new Date(windowEnd) - new Date(windowStart)) / 60000
        )} хв.`
      );
    }
  }

  if (fiveXxCount >= FIVE_XX_THRESHOLD) {
    await notify(`Security Agent: сплеск помилок сервера\n${fiveXxCount} відповідей 5xx за останні ~${Math.round(
      (new Date(windowEnd) - new Date(windowStart)) / 60000
    )} хв.`);
  }
}

// Ad-hoc, chat-triggered: top IPs by 401 count over the last `hours` (default
// 24). Render's free/Hobby tier only retains 7 days of logs — a request for
// anything older than that gets an honest "unavailable" reply instead of a
// silently empty/misleading one (see securityAgent.js).
async function topSuspiciousIps(hours = 24) {
  if (!isConfigured()) return { configured: false };
  const endTime = new Date().toISOString();
  const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const logs = await fetchLogs(startTime, endTime);
  const lines = parseAppLogLines(logs);

  const failedByIp = new Map();
  for (const line of lines) {
    if (line.status === 401 || line.status === 403) failedByIp.set(line.ip, (failedByIp.get(line.ip) || 0) + 1);
  }
  const sorted = [...failedByIp.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  return { configured: true, hours, top: sorted };
}

module.exports = { runRenderLogAudit, topSuspiciousIps, isConfigured };
