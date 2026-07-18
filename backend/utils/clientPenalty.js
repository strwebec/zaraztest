const User = require('../models/User');

const HOUR_MS = 60 * 60 * 1000;

/**
 * Applies the client rating/blocking rules from the cancellation policy:
 * late cancellation/reschedule -> -1 and 48h block; no-show -> -2 and 48h block.
 * At 3 consecutive violations the block extends to 7 days; at 5, the account goes under review.
 */
async function applyClientViolation(userId, type) {
  if (!userId) return;
  const user = await User.findById(userId);
  if (!user) return;

  user.rating = Math.max(0, user.rating - (type === 'no_show' ? 2 : 1));
  user.consecutiveViolations += 1;

  let blockHours = 48;
  if (user.consecutiveViolations >= 5) {
    user.underReview = true;
  } else if (user.consecutiveViolations >= 3) {
    blockHours = 7 * 24;
  }
  user.blockedUntil = new Date(Date.now() + blockHours * HOUR_MS);

  await user.save();
}

/** Resets the violation streak after a clean, on-time booking (keeps rating from spiraling forever). */
async function clearViolationStreak(userId) {
  if (!userId) return;
  await User.updateOne({ _id: userId }, { consecutiveViolations: 0 });
}

module.exports = { applyClientViolation, clearViolationStreak };
