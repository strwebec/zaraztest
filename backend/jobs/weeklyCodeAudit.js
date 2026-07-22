const { notify } = require('../utils/telegramNotifier');

// Security Agent v1c — a weekly, bounded, advisory-only code review. Not a
// local `git diff`: whether Render's runtime filesystem still has .git after
// a build isn't something to depend on, and GitHub's own Compare API already
// gives the same diff reliably, reusing the GITHUB_TOKEN/GITHUB_REPO already
// provisioned in Phase 6. Bounded on purpose — one diff, one Claude call,
// once a week — not a standing watch, so the cost stays small and
// predictable. Purely advisory: it only ever posts a digest to Telegram,
// never opens a PR or touches any file (see
// .claude/plans/tidy-tickling-wilkinson.md's Phase 6-8 scoping).
const MAX_DIFF_CHARS = 60000;

function isConfigured() {
  return !!(process.env.GITHUB_TOKEN && process.env.GITHUB_REPO && process.env.ANTHROPIC_API_KEY);
}

async function fetchWeekDiff() {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const commitsRes = await fetch(
    `https://api.github.com/repos/${process.env.GITHUB_REPO}/commits?sha=main&since=${since}&per_page=100`,
    { headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' } }
  );
  if (!commitsRes.ok) throw new Error(`GitHub commits API ${commitsRes.status}: ${await commitsRes.text()}`);
  const commits = await commitsRes.json();
  if (!commits.length) return null;

  const newest = commits[0].sha;
  const oldestCommit = commits[commits.length - 1];
  // Diff against the commit BEFORE the oldest one in the window, so that
  // commit's own changes are included — not just everything after it.
  const base = oldestCommit.parents?.[0]?.sha || oldestCommit.sha;

  const compareRes = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPO}/compare/${base}...${newest}`, {
    headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3.diff' },
  });
  if (!compareRes.ok) throw new Error(`GitHub compare API ${compareRes.status}: ${await compareRes.text()}`);
  return { diff: await compareRes.text(), commitCount: commits.length };
}

async function askClaudeForRiskyPatterns(diff) {
  const truncated = diff.length > MAX_DIFF_CHARS;
  const body = truncated ? diff.slice(0, MAX_DIFF_CHARS) : diff;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      messages: [
        {
          role: 'user',
          content:
            'Це git diff за останній тиждень для Node/Express + Next.js платформи бронювань (ZARAZ). ' +
            'Познач лише НОВІ ризиковані патерни, які цей diff вносить: проблеми безпеки (auth, injection, ' +
            'відсутня валідація, витік секретів), або явні баги. Не переказуй, що робить код — тільки конкретні ризики. ' +
            'Якщо нічого суттєвого немає — так і напиши одним реченням. Відповідай українською, стисло.\n\n' +
            `${truncated ? '(diff обрізано до перших 60000 символів)\n\n' : ''}${body}`,
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content?.[0]?.text || '(порожня відповідь)';
}

async function runWeeklyCodeAudit() {
  if (!isConfigured()) {
    console.log('[weeklyCodeAudit] GITHUB_TOKEN/GITHUB_REPO/ANTHROPIC_API_KEY not set — skipped');
    return;
  }

  let result;
  try {
    result = await fetchWeekDiff();
  } catch (err) {
    console.error('[weeklyCodeAudit] diff fetch failed:', err.message);
    return;
  }
  if (!result) {
    await notify('Security Agent: щотижневий код-аудит — за останній тиждень не було нових комітів у main.');
    return;
  }

  let review;
  try {
    review = await askClaudeForRiskyPatterns(result.diff);
  } catch (err) {
    console.error('[weeklyCodeAudit] Claude review failed:', err.message);
    return;
  }

  await notify(`Security Agent: щотижневий код-аудит (${result.commitCount} комітів за тиждень)\n\n${review}`);
}

module.exports = { runWeeklyCodeAudit, isConfigured };
