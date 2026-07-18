const mongoose = require('mongoose');
const Business = require('../models/Business');
const Review = require('../models/Review');

async function recomputeBusinessReviewStats(businessId) {
  const stats = await Review.aggregate([
    { $match: { business: new mongoose.Types.ObjectId(businessId), status: 'PUBLISHED' } },
    { $group: { _id: null, avgRating: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);

  const platformRating = stats[0]?.avgRating ?? 0;
  const platformReviewsCount = stats[0]?.count ?? 0;

  await Business.updateOne({ _id: businessId }, { platformRating, platformReviewsCount });
}

module.exports = { recomputeBusinessReviewStats };
