const Business = require('../models/Business');
const Booking = require('../models/Booking');
const Review = require('../models/Review');
const ProfileView = require('../models/ProfileView');

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

async function recomputeBusinessScore(business) {
  const since = new Date(Date.now() - THIRTY_DAYS_MS);
  const sinceDateKey = since.toISOString().slice(0, 10);

  const [bookings, platformReviewsCount, profileViews] = await Promise.all([
    Booking.find({
      business: business._id,
      date: { $gte: sinceDateKey },
      status: { $in: ['confirmed', 'completed'] },
    }).lean(),
    Review.countDocuments({ business: business._id, status: 'PUBLISHED' }),
    ProfileView.countDocuments({ business: business._id, viewedAt: { $gte: since } }),
  ]);

  const bookingsLast30Days = bookings.length;

  const clientCounts = new Map();
  for (const b of bookings) {
    if (!b.client) continue;
    const key = String(b.client);
    clientCounts.set(key, (clientCounts.get(key) || 0) + 1);
  }
  const totalClients = clientCounts.size;
  const repeatClients = [...clientCounts.values()].filter((n) => n > 1).length;
  const repeatClientsRatio = totalClients > 0 ? repeatClients / totalClients : 0;

  const platformPopularityScore =
    bookingsLast30Days * 0.4 + platformReviewsCount * 0.3 + profileViews * 0.2 + repeatClientsRatio * 0.1;

  const ageMs = Date.now() - new Date(business.createdAt).getTime();
  const freshnessMultiplier = ageMs < THIRTY_DAYS_MS ? 1.2 : 1;

  const googleRating = business.googleRating || 0;
  const googleReviewsCount = business.googleReviewsCount || 0;
  const underPenalty = business.catalogPenaltyUntil && new Date(business.catalogPenaltyUntil) > new Date();
  const penaltyMultiplier = underPenalty ? 0.8 : 1;
  const catalogScore =
    googleRating * Math.log10(googleReviewsCount + 1) * platformPopularityScore * freshnessMultiplier * penaltyMultiplier;

  await Business.updateOne(
    { _id: business._id },
    {
      bookingsLast30Days,
      profileViewsLast30Days: profileViews,
      repeatClientsRatio,
      platformPopularityScore,
      catalogScore,
    }
  );
}

async function runDailyRatingUpdate() {
  const businesses = await Business.find({ status: { $in: ['ACTIVE', 'HIDDEN'] } }).lean();
  for (const business of businesses) {
    await recomputeBusinessScore(business);
  }
  console.log(`[dailyRatingUpdate] recomputed scores for ${businesses.length} businesses`);
}

module.exports = { runDailyRatingUpdate };
