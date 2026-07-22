const rateLimit = require('express-rate-limit');

// login/register are IP-keyed (5 per 15 min, shared across every account
// hitting this server from the same machine) — fine for real traffic, but it
// means an E2E suite exercising multiple roles blows through the cap almost
// immediately even though no individual user ever would. `skip` only fires
// when the process was explicitly started with NODE_ENV=test (never how the
// app is deployed) — every other limiter, and production/normal dev
// behavior for these two, is unaffected.
const skipInTest = () => process.env.NODE_ENV === 'test';

const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // A single browsing session (catalog + a couple of business profiles + their
  // availability/review lookups) can easily reach a few dozen requests, and every
  // route-specific limiter below is layered on top of this global one anyway — this
  // just needs to stop abuse, not double as the real per-route budget.
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TOO_MANY_ATTEMPTS' },
});

const authedLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TOO_MANY_ATTEMPTS' },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TOO_MANY_ATTEMPTS' },
  skip: skipInTest,
});

// Looser than login/register: legitimate traffic hits this often (every role-gated
// layout mounting its own useMe()/useBusinessMe() on a full reload, multiple tabs),
// per the grace-window comment in routes/auth.js — but it still needs a real cap
// since a stolen/guessed refresh token being hammered is exactly what rotation is
// meant to blunt.
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TOO_MANY_ATTEMPTS' },
  skip: skipInTest,
});

// Same window/limit as login — prevents automated account-creation spam and email flooding.
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TOO_MANY_ATTEMPTS' },
  skip: skipInTest,
});

// A 6-digit code has only 1M combinations — cap attempts per IP well below what
// brute-forcing it would need, tighter than login/register's 5-per-window.
const verifyCodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TOO_MANY_ATTEMPTS' },
  skip: skipInTest,
});

const bookingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TOO_MANY_ATTEMPTS' },
});

const reviewLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TOO_MANY_ATTEMPTS' },
});

const catalogLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TOO_MANY_ATTEMPTS' },
});

const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TOO_MANY_ATTEMPTS' },
});

// The webhook path itself is already gated by a secret-token header + a
// single-chat-id allowlist (see telegram/webhookRoute.js) — this is a last
// line of defense against the endpoint being hammered, not the primary
// protection. One Telegram chat sending normal messages never comes close.
const telegramWebhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TOO_MANY_ATTEMPTS' },
});

module.exports = {
  publicLimiter,
  authedLimiter,
  loginLimiter,
  refreshLimiter,
  registerLimiter,
  verifyCodeLimiter,
  bookingLimiter,
  reviewLimiter,
  catalogLimiter,
  adminLimiter,
  telegramWebhookLimiter,
};
