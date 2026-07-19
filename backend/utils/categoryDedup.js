const Category = require('../models/Category');

// Case/whitespace-insensitive match against any category a business could already
// see or use — active ones and other businesses' still-pending proposals — so two
// businesses proposing "Тату" one after another don't end up with two near-duplicate
// entries for a moderator to reconcile by hand.
async function findDuplicateCategory(name) {
  const normalized = (name || '').trim();
  if (!normalized) return null;
  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^${escaped}$`, 'i');
  return Category.findOne({
    status: { $in: ['ACTIVE', 'PENDING'] },
    $or: [{ name: re }, { nameEn: re }],
  }).lean();
}

module.exports = { findDuplicateCategory };
