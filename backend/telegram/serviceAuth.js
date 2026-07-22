const http = require('http');

// The Telegram bot authenticates to ZARAZ's own API exactly the way any other
// admin does — by logging into the existing, unmodified POST /api/auth/login
// and holding the resulting httpOnly cookies — rather than through a new
// bearer/API-key path. See .claude/plans/tidy-tickling-wilkinson.md for why:
// middleware/auth.js only ever reads req.cookies, so this keeps that file (and
// the least-privilege permission-bucket model it enforces) completely
// untouched. Calls stay on the same machine/process (127.0.0.1), so this adds
// no new public attack surface.
const PORT = process.env.PORT || 4000;

// Access tokens expire in 15m (utils/tokens.js) — refresh well before that so
// a slow response never races an expiring cookie.
const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

let cookies = {};
let refreshTimer = null;

function cookieHeader() {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

function applySetCookie(setCookieArr) {
  if (!setCookieArr) return;
  for (const line of setCookieArr) {
    const [nameValue] = line.split(';');
    const idx = nameValue.indexOf('=');
    if (idx === -1) continue;
    const name = nameValue.slice(0, idx).trim();
    const value = nameValue.slice(idx + 1).trim();
    cookies[name] = value;
  }
}

function requestLocal(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = { ...(cookieHeader() ? { Cookie: cookieHeader() } : {}) };
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = http.request({ host: '127.0.0.1', port: PORT, path, method, headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed;
        try {
          parsed = data ? JSON.parse(data) : {};
        } catch {
          parsed = {};
        }
        resolve({ status: res.statusCode, body: parsed, setCookie: res.headers['set-cookie'] });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function login() {
  const email = process.env.TELEGRAM_BOT_SERVICE_EMAIL;
  const password = process.env.TELEGRAM_BOT_SERVICE_PASSWORD;
  if (!email || !password) throw new Error('TELEGRAM_BOT_SERVICE_EMAIL/TELEGRAM_BOT_SERVICE_PASSWORD not set');
  const res = await requestLocal('POST', '/api/auth/login', { email, password });
  if (res.status !== 200) throw new Error(`bot service account login failed: ${res.status} ${JSON.stringify(res.body)}`);
  applySetCookie(res.setCookie);
}

async function refresh() {
  const res = await requestLocal('POST', '/api/auth/refresh', null);
  if (res.status !== 200) throw new Error(`bot service account refresh failed: ${res.status} ${JSON.stringify(res.body)}`);
  applySetCookie(res.setCookie);
}

// Every route the agents call is one of the platform's own, already-audited
// admin routes — this never grows a new authorization path, it just replays
// the session cookie a browser admin would have.
async function callAdminApi(method, path, body) {
  let res = await requestLocal(method, path, body);
  if (res.status === 401) {
    // Session cookie expired/invalid despite the refresh timer (e.g. server
    // just restarted and lost the in-memory jar) — log in again once and retry.
    await login();
    res = await requestLocal(method, path, body);
  }
  return res;
}

function scheduleRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    refresh().catch((err) => {
      console.error('[telegram/serviceAuth] refresh failed, will re-login on next call', err.message);
    });
  }, REFRESH_INTERVAL_MS);
  refreshTimer.unref();
}

async function init() {
  const email = process.env.TELEGRAM_BOT_SERVICE_EMAIL;
  const password = process.env.TELEGRAM_BOT_SERVICE_PASSWORD;
  if (!email || !password) {
    console.log('[telegram/serviceAuth] TELEGRAM_BOT_SERVICE_EMAIL/PASSWORD not set — bot service account disabled');
    return;
  }
  await login();
  scheduleRefresh();
  console.log('[telegram/serviceAuth] bot service account session established');
}

module.exports = { init, callAdminApi };
