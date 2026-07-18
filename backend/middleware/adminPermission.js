// MODERATOR and FINANCE_ADMIN keep their existing fixed bundles (unchanged
// behavior); only the flexible ADMIN role is actually checked against the
// per-account `permissions` array a super-admin picked at invite time.
const MODERATOR_BUCKETS = ['businesses', 'reviews', 'categories', 'topPlacements', 'users', 'support'];

function hasAdminPermission(role, permissions, bucket) {
  if (role === 'SUPER_ADMIN') return true;
  if (role === 'MODERATOR') return MODERATOR_BUCKETS.includes(bucket);
  if (role === 'FINANCE_ADMIN') return bucket === 'finance';
  if (role === 'ADMIN') return (permissions || []).includes(bucket);
  return false;
}

function requirePermission(bucket) {
  return (req, res, next) => {
    if (!hasAdminPermission(req.userRole, req.userPermissions, bucket)) {
      return res.status(403).json({ error: 'FORBIDDEN' });
    }
    next();
  };
}

module.exports = { hasAdminPermission, requirePermission, MODERATOR_BUCKETS };
