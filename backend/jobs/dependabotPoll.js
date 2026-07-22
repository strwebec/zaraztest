const { notify } = require('../utils/telegramNotifier');

// Security Agent v1a — polls Dependabot alerts on a schedule rather than a
// GitHub webhook, deliberately: a webhook would be a second new public entry
// point into this server, on top of the Telegram one from Phase 1 (see
// .claude/plans/tidy-tickling-wilkinson.md's architecture rationale). Needs a
// GitHub PAT with read access to the repo's Dependabot alerts — no-ops
// entirely (logs once) until GITHUB_TOKEN/GITHUB_REPO are set.
const alreadyNotified = new Set();

async function fetchOpenAlerts() {
  const res = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPO}/dependabot/alerts?state=open`, {
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function runDependabotPoll() {
  if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_REPO) {
    console.log('[dependabotPoll] GITHUB_TOKEN/GITHUB_REPO not set — skipped');
    return;
  }

  let alerts;
  try {
    alerts = await fetchOpenAlerts();
  } catch (err) {
    console.error('[dependabotPoll] fetch failed:', err.message);
    return;
  }

  for (const alert of alerts) {
    if (alreadyNotified.has(alert.number)) continue;
    alreadyNotified.add(alert.number);

    const text = [
      'Security Agent: новий Dependabot alert',
      `Пакет: ${alert.dependency?.package?.name || '?'}`,
      `Severity: ${alert.security_advisory?.severity || '?'}`,
      alert.security_advisory?.summary || '',
      alert.html_url,
    ]
      .filter(Boolean)
      .join('\n');
    await notify(text);
  }

  // Alerts that closed since the last poll (fixed/dismissed) no longer need
  // tracking — without this, alreadyNotified would grow forever.
  const stillOpen = new Set(alerts.map((a) => a.number));
  for (const number of alreadyNotified) {
    if (!stillOpen.has(number)) alreadyNotified.delete(number);
  }
}

module.exports = { runDependabotPoll };
