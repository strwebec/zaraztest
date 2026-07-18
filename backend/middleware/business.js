const Business = require('../models/Business');

async function attachBusiness(req, res, next) {
  const business = await Business.findOne({ owner: req.userId });
  if (!business) return res.status(404).json({ error: 'BUSINESS_NOT_FOUND' });
  req.businessId = business._id;
  req.businessDoc = business;
  next();
}

module.exports = { attachBusiness };
