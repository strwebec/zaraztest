const crypto = require('crypto');

// Ukrainian category names don't transliterate cleanly to a stable ASCII slug,
// so a custom category just gets a short random id — the real (Ukrainian/English)
// name is what's actually shown anywhere in the UI, the slug is only a DB key.
function customCategorySlug() {
  return `custom-${crypto.randomBytes(4).toString('hex')}`;
}

// Same reasoning as customCategorySlug() — Ukrainian city names don't transliterate
// cleanly to a stable ASCII slug, so a newly registered city just gets a short random
// id; the real name is what's actually shown anywhere in the UI.
function customCitySlug() {
  return `city-${crypto.randomBytes(4).toString('hex')}`;
}

module.exports = { customCategorySlug, customCitySlug };
