// Blends Google and platform ratings 60/40 — but only once both sources actually
// have reviews. A business with zero Google reviews isn't "0 stars on Google", it's
// "no Google data" — treating it as a real zero silently capped every business
// without a synced Google presence at 2.0 stars no matter how good their platform
// reviews were. Whichever single source has reviews gets full weight instead.
function computeBusinessRating(business) {
  const hasGoogle = (business.googleReviewsCount || 0) > 0;
  const hasPlatform = (business.platformReviewsCount || 0) > 0;
  if (hasGoogle && hasPlatform) {
    return business.googleRating * 0.6 + business.platformRating * 0.4;
  }
  if (hasPlatform) return business.platformRating;
  if (hasGoogle) return business.googleRating;
  return 0;
}

module.exports = { computeBusinessRating };
