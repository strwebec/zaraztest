const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const User = require('../models/User');
const Business = require('../models/Business');
const City = require('../models/City');
const Category = require('../models/Category');
const { customCategorySlug } = require('../utils/slugify');
const { findDuplicateCategory } = require('../utils/categoryDedup');
const { sendMail } = require('../utils/mailer');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  refreshExpiryDate,
  generateVerificationCode,
  hashToken,
  accessCookieOptions,
  refreshCookieOptions,
} = require('../utils/tokens');
const { loginLimiter, registerLimiter, verifyCodeLimiter } = require('../middleware/rateLimit');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

async function issueSession(res, user) {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  // Only the hash is persisted — a stolen/leaked DB dump can't be replayed as a session.
  user.refreshTokens.push({ token: hashToken(refreshToken), expiresAt: refreshExpiryDate() });
  await user.save();
  res.cookie('accessToken', accessToken, accessCookieOptions());
  res.cookie('refreshToken', refreshToken, refreshCookieOptions());
}

function publicUser(user) {
  return {
    id: user._id,
    role: user.role,
    name: user.name,
    email: user.email,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    city: user.city,
    language: user.language,
    themePref: user.themePref,
    emailVerified: user.emailVerified,
    business: user.business,
    permissions: user.permissions,
    rating: user.rating,
    blockedUntil: user.blockedUntil && user.blockedUntil > new Date() ? user.blockedUntil : null,
    underReview: user.underReview,
  };
}

router.post('/register/client', registerLimiter, asyncHandler(async (req, res) => {
  const { name, email, phone, password, citySlug, agreeToTerms } = req.body || {};
  if (!isNonEmptyString(name) || !isNonEmptyString(password) || !EMAIL_RE.test(email || '')) {
    return res.status(400).json({ error: 'INVALID_INPUT' });
  }
  if (agreeToTerms !== true) return res.status(400).json({ error: 'TERMS_NOT_ACCEPTED' });
  if (password.length < 8) return res.status(400).json({ error: 'WEAK_PASSWORD' });

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) return res.status(409).json({ error: 'EMAIL_TAKEN' });

  const city = citySlug ? await City.findOne({ slug: citySlug }) : null;
  const passwordHash = await bcrypt.hash(password, 12);
  const verificationCode = generateVerificationCode();

  const user = await User.create({
    role: 'CLIENT',
    name,
    email: email.toLowerCase(),
    phone,
    passwordHash,
    city: city?._id,
    emailVerifyToken: hashToken(verificationCode),
    emailVerifyExpires: new Date(Date.now() + 15 * 60 * 1000),
    termsAcceptedAt: new Date(),
  });

  await sendMail({
    to: user.email,
    subject: 'Код підтвердження — ZARAZ',
    html: `Вітаємо, ${name}! Код підтвердження email: ${verificationCode}. Він дійсний 15 хвилин.`,
  });

  // Session is only issued once the code is confirmed via /verify-registration —
  // registering alone must not grant access to the account. In test runs only,
  // echo the code back so Playwright can complete the flow without an inbox.
  res.status(201).json({
    pendingVerification: true,
    email: user.email,
    ...(process.env.NODE_ENV === 'test' ? { devVerificationCode: verificationCode } : {}),
  });
}));

router.post('/register/business', registerLimiter, asyncHandler(async (req, res) => {
  const { ownerName, email, phone, password, businessName, category, customCategoryName, citySlug, agreeToTerms } =
    req.body || {};
  if (
    !isNonEmptyString(ownerName) ||
    !isNonEmptyString(password) ||
    !isNonEmptyString(businessName) ||
    !isNonEmptyString(category) ||
    !EMAIL_RE.test(email || '')
  ) {
    return res.status(400).json({ error: 'INVALID_INPUT' });
  }
  if (agreeToTerms !== true) return res.status(400).json({ error: 'TERMS_NOT_ACCEPTED' });
  if (password.length < 8) return res.status(400).json({ error: 'WEAK_PASSWORD' });
  if (category === 'other' && !isNonEmptyString(customCategoryName)) {
    return res.status(400).json({ error: 'INVALID_INPUT' });
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) return res.status(409).json({ error: 'EMAIL_TAKEN' });

  const city = await City.findOne({ slug: citySlug });
  if (!city) return res.status(400).json({ error: 'INVALID_CITY' });

  // "Other" — the business's category isn't in the approved list yet. Create it as
  // PENDING so it works right away for this business but doesn't appear as a public
  // filter/option for anyone else until a super-admin approves it.
  let categorySlug = category;
  let pendingCategory = null;
  if (category === 'other') {
    const duplicate = await findDuplicateCategory(customCategoryName);
    if (duplicate) return res.status(409).json({ error: 'CATEGORY_ALREADY_EXISTS', category: duplicate });
    pendingCategory = await Category.create({
      slug: customCategorySlug(),
      name: customCategoryName.trim(),
      nameEn: customCategoryName.trim(),
      status: 'PENDING',
    });
    categorySlug = pendingCategory.slug;
  } else {
    const existingCategory = await Category.findOne({ slug: category, status: 'ACTIVE' });
    if (!existingCategory) return res.status(400).json({ error: 'INVALID_CATEGORY' });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const verificationCode = generateVerificationCode();

  const user = await User.create({
    role: 'BUSINESS_OWNER',
    name: ownerName,
    email: email.toLowerCase(),
    phone,
    passwordHash,
    city: city._id,
    emailVerifyToken: hashToken(verificationCode),
    emailVerifyExpires: new Date(Date.now() + 15 * 60 * 1000),
    termsAcceptedAt: new Date(),
  });

  const business = await Business.create({
    owner: user._id,
    name: businessName,
    category: categorySlug,
    city: city._id,
    phone,
    status: 'PENDING',
    agreementAcceptedAt: new Date(),
  });

  user.business = business._id;
  await user.save();

  if (pendingCategory) {
    pendingCategory.requestedByBusiness = business._id;
    await pendingCategory.save();
  }

  await sendMail({
    to: user.email,
    subject: 'Код підтвердження — ZARAZ',
    html: `Дякуємо за реєстрацію "${businessName}"! Код підтвердження email: ${verificationCode}. Він дійсний 15 хвилин. Профіль на розгляді у супер-адміна.`,
  });

  // Session is only issued once the code is confirmed via /verify-registration —
  // registering alone must not grant access to the account. In test runs only,
  // echo the code back so Playwright can complete the flow without an inbox.
  res.status(201).json({
    pendingVerification: true,
    email: user.email,
    ...(process.env.NODE_ENV === 'test' ? { devVerificationCode: verificationCode } : {}),
  });
}));

router.post('/login', loginLimiter, asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (!EMAIL_RE.test(email || '') || !isNonEmptyString(password)) {
    return res.status(400).json({ error: 'INVALID_INPUT' });
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });

  const validPassword = await bcrypt.compare(password, user.passwordHash);
  if (!validPassword) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });

  if (!user.emailVerified) {
    return res.status(403).json({ error: 'EMAIL_NOT_VERIFIED', email: user.email });
  }

  if (user.blockedUntil && user.blockedUntil > new Date()) {
    return res.status(403).json({ error: 'ACCOUNT_BLOCKED', until: user.blockedUntil });
  }

  await issueSession(res, user);
  res.json({ user: publicUser(user) });
}));

// Refresh tokens rotate on every use (see issueSession) so a leaked one is only ever
// good for a single replay. That rotation is otherwise indistinguishable from a bug:
// a browser tab can fire two /refresh calls close together (e.g. several role-gated
// layouts each mounting their own useMe()/useBusinessMe() on a full page reload, or
// two tabs open at once) — the second one arrives after the first already rotated the
// token out, and without this grace window it would hard-fail with UNAUTHENTICATED,
// forcing a real logout even though the session was perfectly valid seconds earlier.
const REFRESH_GRACE_MS = 10 * 1000;

router.post('/refresh', asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) return res.status(401).json({ error: 'UNAUTHENTICATED' });

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    return res.status(401).json({ error: 'UNAUTHENTICATED' });
  }

  const user = await User.findById(payload.sub);
  const tokenHash = hashToken(token);
  const stored = user?.refreshTokens.find((rt) => rt.token === tokenHash);
  if (!user || !stored) return res.status(401).json({ error: 'UNAUTHENTICATED' });
  if (stored.expiresAt < new Date()) return res.status(401).json({ error: 'UNAUTHENTICATED' });

  const graceCutoff = new Date(Date.now() + REFRESH_GRACE_MS);
  if (stored.expiresAt > graceCutoff) {
    // First use of this token — shrink its remaining lifetime to the grace window
    // instead of deleting it outright, so a near-simultaneous duplicate request can
    // still succeed. Already-in-grace tokens are left as-is (not re-extended) so a
    // stolen token can't be kept alive indefinitely by repeatedly polling it.
    stored.expiresAt = graceCutoff;
  }
  await issueSession(res, user);
  res.json({ user: publicUser(user) });
}));

router.post('/logout', requireAuth, asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (token) {
    await User.updateOne({ _id: req.userId }, { $pull: { refreshTokens: { token: hashToken(token) } } });
  }
  res.clearCookie('accessToken', accessCookieOptions());
  res.clearCookie('refreshToken', refreshCookieOptions());
  res.json({ ok: true });
}));

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(401).json({ error: 'UNAUTHENTICATED' });
  res.json({ user: publicUser(user) });
}));

router.post('/verify-registration', verifyCodeLimiter, asyncHandler(async (req, res) => {
  const { email, code } = req.body || {};
  if (!EMAIL_RE.test(email || '') || !isNonEmptyString(code)) {
    return res.status(400).json({ error: 'INVALID_INPUT' });
  }
  const user = await User.findOne({ email: email.toLowerCase() });
  const storedCodeHash = user?.emailVerifyToken;
  const incomingCodeHash = hashToken(code);
  const codesMatch =
    storedCodeHash &&
    storedCodeHash.length === incomingCodeHash.length &&
    crypto.timingSafeEqual(Buffer.from(storedCodeHash), Buffer.from(incomingCodeHash));

  if (!user || !codesMatch || user.emailVerifyExpires < new Date()) {
    return res.status(400).json({ error: 'INVALID_OR_EXPIRED_CODE' });
  }

  user.emailVerified = true;
  user.emailVerifyToken = undefined;
  user.emailVerifyExpires = undefined;
  await user.save();

  await issueSession(res, user);
  res.json({ user: publicUser(user) });
}));

router.post('/resend-code', registerLimiter, asyncHandler(async (req, res) => {
  const { email } = req.body || {};
  if (!EMAIL_RE.test(email || '')) return res.status(400).json({ error: 'INVALID_INPUT' });

  const user = await User.findOne({ email: email.toLowerCase() });
  // Always respond ok regardless of whether the account exists or is already
  // verified — a distinct response here would let an attacker enumerate emails.
  if (user && !user.emailVerified) {
    const verificationCode = generateVerificationCode();
    user.emailVerifyToken = hashToken(verificationCode);
    user.emailVerifyExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();
    await sendMail({
      to: user.email,
      subject: 'Код підтвердження — ZARAZ',
      html: `Ваш новий код підтвердження email: ${verificationCode}. Він дійсний 15 хвилин.`,
    });
  }
  res.json({ ok: true });
}));

router.post('/forgot-password', registerLimiter, asyncHandler(async (req, res) => {
  const { email } = req.body || {};
  if (!EMAIL_RE.test(email || '')) return res.status(400).json({ error: 'INVALID_INPUT' });

  const user = await User.findOne({ email: email.toLowerCase() });
  // Always respond ok regardless of whether the account exists — a distinct response
  // here would let an attacker enumerate registered emails (same as /resend-code).
  if (user) {
    const resetCode = generateVerificationCode();
    user.passwordResetToken = hashToken(resetCode);
    user.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();
    await sendMail({
      to: user.email,
      subject: 'Відновлення пароля — ZARAZ',
      html: `Код для відновлення пароля: ${resetCode}. Він дійсний 15 хвилин. Якщо ви не запитували відновлення — просто проігноруйте цей лист.`,
    });
  }
  res.json({ ok: true });
}));

router.post('/reset-password', verifyCodeLimiter, asyncHandler(async (req, res) => {
  const { email, code, newPassword } = req.body || {};
  if (!EMAIL_RE.test(email || '') || !isNonEmptyString(code) || !isNonEmptyString(newPassword)) {
    return res.status(400).json({ error: 'INVALID_INPUT' });
  }
  if (newPassword.length < 8) return res.status(400).json({ error: 'WEAK_PASSWORD' });

  const user = await User.findOne({ email: email.toLowerCase() });
  const storedCodeHash = user?.passwordResetToken;
  const incomingCodeHash = hashToken(code);
  const codesMatch =
    storedCodeHash &&
    storedCodeHash.length === incomingCodeHash.length &&
    crypto.timingSafeEqual(Buffer.from(storedCodeHash), Buffer.from(incomingCodeHash));

  if (!user || !codesMatch || user.passwordResetExpires < new Date()) {
    return res.status(400).json({ error: 'INVALID_OR_EXPIRED_CODE' });
  }

  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  // A password reset means any session token issued before it (e.g. from whoever
  // triggered the need to reset) should stop working — force every device to log in
  // again with the new password rather than silently staying signed in.
  user.refreshTokens = [];
  await user.save();

  await issueSession(res, user);
  res.json({ user: publicUser(user) });
}));

module.exports = router;
