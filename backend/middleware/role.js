function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      return res.status(403).json({ error: 'FORBIDDEN' });
    }
    next();
  };
}

module.exports = { requireRole };
