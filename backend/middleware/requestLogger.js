// Structured one-line-per-request access log — the foundation the Security
// Agent (Telegram AI-team, see .claude/plans/tidy-tickling-wilkinson.md) polls
// for anomaly rules (401 spikes, 5xx spikes, etc.) via Render's Logs API.
//
// Deliberately logs ONLY: timestamp, method, path, status, ip, userId (if
// authenticated by the time the response finishes), durationMs. It NEVER logs
// request/response bodies, headers, query strings, or cookies — those can
// carry passwords, tokens, or verification codes (see routes/auth.js) and must
// never reach Render's log storage. Do not add fields to this line without
// re-checking that guarantee.
function requestLogger(req, res, next) {
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const entry = {
      t: new Date().toISOString(),
      method: req.method,
      path: req.baseUrl + (req.route ? req.route.path : req.path),
      status: res.statusCode,
      ip: req.ip,
      userId: req.userId || null,
      durationMs: Math.round(durationMs),
    };
    console.log(JSON.stringify(entry));
  });

  next();
}

module.exports = { requestLogger };
