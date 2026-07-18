const { verifyAccessToken } = require('../utils/tokens');

function requireAuth(req, res, next) {
  const token = req.cookies?.accessToken;
  if (!token) return res.status(401).json({ error: 'UNAUTHENTICATED' });
  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.sub;
    req.userRole = payload.role;
    req.userPermissions = payload.permissions || [];
    next();
  } catch {
    return res.status(401).json({ error: 'UNAUTHENTICATED' });
  }
}

function optionalAuth(req, _res, next) {
  const token = req.cookies?.accessToken;
  if (token) {
    try {
      const payload = verifyAccessToken(token);
      req.userId = payload.sub;
      req.userRole = payload.role;
      req.userPermissions = payload.permissions || [];
    } catch {
      /* ignore invalid token for optional auth */
    }
  }
  next();
}

module.exports = { requireAuth, optionalAuth };
