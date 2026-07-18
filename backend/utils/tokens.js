const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const JWT_ALGORITHM = 'HS256';

function signAccessToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, process.env.JWT_ACCESS_SECRET, {
    algorithm: JWT_ALGORITHM,
    expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m',
  });
}

function signRefreshToken(user) {
  return jwt.sign({ sub: user._id.toString() }, process.env.JWT_REFRESH_SECRET, {
    algorithm: JWT_ALGORITHM,
    expiresIn: process.env.JWT_REFRESH_EXPIRES || '30d',
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET, { algorithms: [JWT_ALGORITHM] });
}

function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET, { algorithms: [JWT_ALGORITHM] });
}

function refreshExpiryDate() {
  const days = parseInt((process.env.JWT_REFRESH_EXPIRES || '30d').replace('d', ''), 10) || 30;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

// A 6-digit code the user types in by hand, not a link token — short enough to
// read off an email on a phone, expiry is correspondingly short (see auth routes).
function generateVerificationCode() {
  return crypto.randomInt(0, 1000000).toString().padStart(6, '0');
}

// Refresh tokens are bearer credentials — store only a SHA-256 hash in the
// database so a DB dump alone can't be replayed as a valid session cookie.
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

const COOKIE_BASE = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};

function accessCookieOptions() {
  return { ...COOKIE_BASE, maxAge: 15 * 60 * 1000 };
}

function refreshCookieOptions() {
  return { ...COOKIE_BASE, maxAge: 30 * 24 * 60 * 60 * 1000 };
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  refreshExpiryDate,
  generateVerificationCode,
  hashToken,
  accessCookieOptions,
  refreshCookieOptions,
};
