require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const cron = require('node-cron');

const { connectDB } = require('./config/db');
const { publicLimiter } = require('./middleware/rateLimit');
const { requestLogger } = require('./middleware/requestLogger');
const { runDailyRatingUpdate } = require('./jobs/dailyRatingUpdate');
const { runMonthlyInvoices, isInvoiceGenerationDay } = require('./jobs/monthlyInvoices');
const { runDailySweep } = require('./jobs/autoUnblock');
const { sendDailyPaymentReminders } = require('./jobs/paymentReminders');
const { runTopPlacementActivation } = require('./jobs/topPlacementActivation');
const { runSheetsSync } = require('./jobs/sheetsSync');
const { runAutoCompleteBookings } = require('./jobs/autoCompleteBookings');
const { mountTelegramWebhook } = require('./telegram/webhookRoute');
const { init: initTelegramServiceAuth } = require('./telegram/serviceAuth');
const { runAuditLogWatch } = require('./jobs/auditLogWatch');
const { runDependabotPoll } = require('./jobs/dependabotPoll');
const { runRenderLogAudit } = require('./jobs/renderLogAudit');

const authRoutes = require('./routes/auth');
const catalogRoutes = require('./routes/catalog');
const bookingRoutes = require('./routes/bookings');
const clientRoutes = require('./routes/client');
const businessRoutes = require('./routes/business');
const businessCrmRoutes = require('./routes/businessCrm');
const adminRoutes = require('./routes/admin');
const supportRoutes = require('./routes/support');

// Fail fast on startup rather than silently signing tokens with a weak/missing
// secret — a short or shared secret makes every JWT in the system forgeable.
function assertRequiredEnv() {
  const required = ['MONGODB_URI', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'ALLOWED_ORIGIN', 'LEDGER_ENCRYPTION_KEY'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  if (process.env.JWT_ACCESS_SECRET.length < 32) {
    throw new Error('JWT_ACCESS_SECRET must be at least 32 characters long');
  }
  if (process.env.JWT_REFRESH_SECRET.length < 32) {
    throw new Error('JWT_REFRESH_SECRET must be at least 32 characters long');
  }
  if (process.env.JWT_ACCESS_SECRET === process.env.JWT_REFRESH_SECRET) {
    throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different values');
  }
  // Business ledger entries (revenue/expense figures the owner enters) are encrypted at
  // rest with this key — a 32-byte AES-256 key, hex-encoded, so it's exactly 64 chars.
  if (!/^[0-9a-fA-F]{64}$/.test(process.env.LEDGER_ENCRYPTION_KEY)) {
    throw new Error('LEDGER_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }
}
assertRequiredEnv();

const app = express();

// Requests arrive via the Next.js dev server's rewrite proxy (and, in prod, a platform
// edge proxy), which sets X-Forwarded-For for the real client IP. Without this,
// express-rate-limit refuses to start (ERR_ERL_UNEXPECTED_X_FORWARDED_FOR) because it
// won't guess whether that header is trustworthy — every rate-limited route (login,
// register, etc.) was throwing on every request. Trusting exactly one hop keys the
// limiter off the real client IP instead of the proxy's.
app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })
);
app.use((_req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN,
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(requestLogger);
app.use(publicLimiter);
app.use('/uploads', express.static(require('path').join(__dirname, 'uploads')));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/client', clientRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/business', businessCrmRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/support', supportRoutes);

// No-ops entirely (logs one notice, mounts nothing) until every TELEGRAM_*
// env var below is set — see telegram/webhookRoute.js.
mountTelegramWebhook(app);

app.use((req, res) => res.status(404).json({ error: 'NOT_FOUND' }));

app.use((err, _req, res, _next) => {
  if (err && err.name === 'MulterError') {
    return res.status(400).json({ error: 'INVALID_FILE', detail: err.code });
  }
  console.error(err);
  res.status(500).json({ error: 'INTERNAL_ERROR' });
});

const port = process.env.PORT || 4000;

connectDB()
  .then(() => {
    app.listen(port, () => console.log(`[server] listening on http://localhost:${port}`));

    // No-ops entirely (logs one notice) until TELEGRAM_BOT_SERVICE_EMAIL/
    // PASSWORD are set — see telegram/serviceAuth.js.
    initTelegramServiceAuth().catch((err) => console.error('[telegram/serviceAuth] init failed', err));

    // Daily at 00:00: recompute catalog ranking scores, expire TOP placements, escalate overdue invoices.
    cron.schedule('0 0 * * *', () => {
      runDailyRatingUpdate().catch((err) => console.error('[cron] dailyRatingUpdate failed', err));
      runDailySweep().catch((err) => console.error('[cron] dailySweep failed', err));
    });

    // Daily at 00:05: generate commission invoices for the prior month, but only on
    // the 1st (or the 2nd if the 1st was a Sunday) — see isInvoiceGenerationDay.
    cron.schedule('5 0 * * *', () => {
      if (!isInvoiceGenerationDay()) return;
      runMonthlyInvoices().catch((err) => console.error('[cron] monthlyInvoices failed', err));
    });

    // Daily at 09:00: remind businesses with unpaid invoices (24h+ overdue) once per day.
    cron.schedule('0 9 * * *', () => {
      sendDailyPaymentReminders().catch((err) => console.error('[cron] paymentReminders failed', err));
    });

    // Every 5 minutes: activate TOP placements whose 15-minute post-confirmation
    // window has elapsed without an admin rejection.
    cron.schedule('*/5 * * * *', () => {
      runTopPlacementActivation().catch((err) => console.error('[cron] topPlacementActivation failed', err));
    });

    // Every 5 minutes: mirror upcoming bookings to each business's backup Google
    // Sheet, and import any rows they typed in manually while offline. No-ops
    // silently if GOOGLE_SHEETS_CLIENT_EMAIL/GOOGLE_SHEETS_PRIVATE_KEY aren't set.
    cron.schedule('*/5 * * * *', () => {
      runSheetsSync().catch((err) => console.error('[cron] sheetsSync failed', err));
    });

    // Every 5 minutes: auto-complete confirmed bookings whose scheduled end time has
    // passed without the business marking them completed/no-show/cancelled — keeps
    // revenue/analytics/rating "live" instead of depending on someone clicking a button.
    cron.schedule('*/5 * * * *', () => {
      runAutoCompleteBookings().catch((err) => console.error('[cron] autoCompleteBookings failed', err));
    });

    // Every 2 minutes: alert on sensitive AdminAuditLog entries (Security Agent v1a).
    cron.schedule('*/2 * * * *', () => {
      runAuditLogWatch().catch((err) => console.error('[cron] auditLogWatch failed', err));
    });

    // Every 30 minutes: alert on new open Dependabot alerts (Security Agent v1a).
    // No-ops silently if GITHUB_TOKEN/GITHUB_REPO aren't set.
    cron.schedule('*/30 * * * *', () => {
      runDependabotPoll().catch((err) => console.error('[cron] dependabotPoll failed', err));
    });

    // Every 10 minutes: rule-based checks over Render's own request logs
    // (Security Agent v1b). No-ops silently if RENDER_API_KEY/RENDER_OWNER_ID/
    // RENDER_SERVICE_ID aren't set.
    cron.schedule('*/10 * * * *', () => {
      runRenderLogAudit().catch((err) => console.error('[cron] renderLogAudit failed', err));
    });
  })
  .catch((err) => {
    console.error('[db] connection failed', err);
    process.exit(1);
  });
