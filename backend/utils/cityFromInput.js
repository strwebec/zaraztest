const City = require('../models/City');
const { customCitySlug } = require('./slugify');

// Case/whitespace-insensitive match against any city that already exists (active
// or not) — mirrors utils/categoryDedup.js's findDuplicateCategory so two people
// registering from "Дрогобич" and "дрогобич " don't end up with two City docs.
async function findExistingCity(name) {
  const normalized = (name || '').trim();
  if (!normalized) return null;
  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^${escaped}$`, 'i');
  return City.findOne({ $or: [{ name: re }, { nameEn: re }] });
}

// Registration accepts either an existing city (citySlug, picked from the list of
// cities that already have approved businesses) or a free-typed new one (cityName,
// same "Other" pattern as utils/categoryDedup.js's category flow). A brand-new city
// starts inactive — it becomes searchable the moment a business registered there
// gets approved (see routes/admin.js's business-approve route), with no separate
// manual "add city" step for the super-admin.
async function resolveCityForRegistration({ citySlug, cityName }) {
  if (isNonEmptyTrimmed(citySlug)) {
    const city = await City.findOne({ slug: citySlug });
    return city || null;
  }
  if (isNonEmptyTrimmed(cityName)) {
    const existing = await findExistingCity(cityName);
    if (existing) return existing;
    return City.create({
      slug: customCitySlug(),
      name: cityName.trim(),
      active: false,
    });
  }
  return null;
}

function isNonEmptyTrimmed(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

module.exports = { resolveCityForRegistration, findExistingCity };
