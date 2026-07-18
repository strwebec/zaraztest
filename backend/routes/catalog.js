const express = require('express');
const crypto = require('crypto');
const City = require('../models/City');
const Business = require('../models/Business');
const Service = require('../models/Service');
const Staff = require('../models/Staff');
const ProfileView = require('../models/ProfileView');
const Review = require('../models/Review');
const User = require('../models/User');
const Category = require('../models/Category');
const { computeFreeSlots } = require('../utils/availability');
const { getOrCreateVirtualStaff } = require('../utils/virtualStaff');
const { asyncHandler } = require('../utils/asyncHandler');
const { optionalAuth } = require('../middleware/auth');
const { catalogLimiter } = require('../middleware/rateLimit');

const router = express.Router();
router.use(catalogLimiter);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VIEW_DEDUPE_WINDOW_MS = 30 * 60 * 1000;

function hashIp(ip) {
  return crypto.createHash('sha256').update(ip || 'unknown').digest('hex');
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

router.get(
  '/cities',
  asyncHandler(async (_req, res) => {
    const cities = await City.find({ active: true }).sort({ name: 1 }).lean();
    res.json({ cities });
  })
);

router.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const categories = await Category.find({ status: 'ACTIVE' })
      .select('slug name nameEn')
      .sort({ name: 1 })
      .lean();
    res.json({ categories: categories.map((c) => ({ id: c.slug, name: c.name, nameEn: c.nameEn })) });
  })
);

router.get(
  '/businesses',
  asyncHandler(async (req, res) => {
    const { city, category, date, sort, q, requireSlot } = req.query;

    if (typeof city !== 'string' || !city) {
      return res.status(400).json({ error: 'CITY_REQUIRED' });
    }
    if (category !== undefined && typeof category !== 'string') {
      return res.status(400).json({ error: 'INVALID_CATEGORY' });
    }
    if (date !== undefined && typeof date !== 'string') {
      return res.status(400).json({ error: 'INVALID_DATE' });
    }
    if (q !== undefined && typeof q !== 'string') {
      return res.status(400).json({ error: 'INVALID_QUERY' });
    }

    const cityDoc = await City.findOne({ slug: city, active: true }).lean();
    if (!cityDoc) return res.status(404).json({ error: 'CITY_NOT_FOUND' });

    const filter = { city: cityDoc._id, status: 'ACTIVE' };
    if (category) {
      // A business matches a category filter either as its primary registration
      // category, or by simply offering an active service in that category — this
      // is what lets a multi-specialty business (e.g. a clinic with dentistry +
      // ophthalmology + general practice) show up under every relevant filter.
      const businessIdsWithService = await Service.distinct('business', { category, active: true });
      filter.$or = [{ category }, { _id: { $in: businessIdsWithService } }];
    }
    if (typeof q === 'string' && q.trim()) {
      // Free-text search: match the business name directly, or match any active
      // service it offers (so searching "манікюр" finds a clinic offering it even
      // though the clinic's own name doesn't contain the word).
      const escaped = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(escaped, 'i');
      const businessIdsWithMatchingService = await Service.distinct('business', { name: re, active: true });
      const searchOr = [{ name: re }, { _id: { $in: businessIdsWithMatchingService } }];
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchOr }];
        delete filter.$or;
      } else {
        filter.$or = searchOr;
      }
    }

    const businesses = await Business.find(filter).lean();
    const targetDate = DATE_RE.test(date || '') ? date : todayStr();

    const results = await Promise.all(
      businesses.map(async (biz) => {
        const services = await Service.find({ business: biz._id, active: true }).sort({ price: 1 }).lean();
        const cheapest = services[0];
        let nextSlot = null;

        if (cheapest) {
          let staffList = await Staff.find({ business: biz._id, active: true, virtual: { $ne: true } }).lean();
          if (!staffList.length) staffList = [(await getOrCreateVirtualStaff(biz)).toObject()];
          for (const staff of staffList) {
            const slots = await computeFreeSlots({
              staff,
              date: targetDate,
              durationMinutes: cheapest.durationMinutes,
            });
            if (slots.length) {
              nextSlot = slots[0];
              break;
            }
          }
        }

        const rating = biz.googleRating * 0.6 + (biz.platformRating || biz.googleRating) * 0.4;
        return {
          id: biz._id,
          name: biz.name,
          category: biz.category,
          district: biz.district,
          rating,
          reviews: biz.googleReviewsCount + biz.platformReviewsCount,
          priceFrom: cheapest?.price ?? null,
          priceFromIsFree: !!cheapest?.isFree,
          coverPhotoUrl: biz.coverPhotoUrl,
          top: !!biz.top?.active,
          nextSlot,
          _score: biz.catalogScore || rating,
        };
      })
    );

    // The actual booking search (Catalog page) needs a real slot on the picked date.
    // Inspirational/browsing rows (home page carousels) shouldn't vanish just because
    // nobody happens to be free at this exact moment — pass requireSlot=false there.
    const withSlot = requireSlot === 'false' ? results : results.filter((r) => r.nextSlot);
    let sorted;
    if (sort === 'price') {
      sorted = withSlot.sort((a, b) => (a.priceFrom ?? Infinity) - (b.priceFrom ?? Infinity));
    } else {
      // TOP is shown after all 5-star businesses but before everything under 5 stars;
      // a 5-star business that also bought TOP stays ranked among the other 5-star ones.
      const fiveStar = withSlot.filter((r) => Math.round(r.rating) === 5).sort((a, b) => b._score - a._score);
      const topNotFiveStar = withSlot
        .filter((r) => r.top && Math.round(r.rating) !== 5)
        .sort((a, b) => b._score - a._score);
      const rest = withSlot
        .filter((r) => !r.top && Math.round(r.rating) !== 5)
        .sort((a, b) => b._score - a._score);
      sorted = [...fiveStar, ...topNotFiveStar, ...rest];
    }
    sorted = sorted.map(({ _score, ...r }) => r);

    res.json({ city: cityDoc, date: targetDate, count: sorted.length, businesses: sorted });
  })
);

router.get(
  '/businesses/:id',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const biz = await Business.findOne({ _id: req.params.id, status: 'ACTIVE' }).lean();
    if (!biz) return res.status(404).json({ error: 'NOT_FOUND' });

    const [services, staff] = await Promise.all([
      Service.find({ business: biz._id, active: true }).lean(),
      Staff.find({ business: biz._id, active: true, virtual: { $ne: true } }).lean(),
      recordProfileView(req, biz),
    ]);

    res.json({ business: biz, services, staff });
  })
);

// Records a catalog profile view for rating-algorithm purposes, while guarding
// against trivial score inflation: skips the owner viewing their own listing,
// and de-dupes repeat hits from the same IP within a rolling window (bot/refresh spam).
async function recordProfileView(req, biz) {
  if (req.userId) {
    const viewer = await User.findById(req.userId).select('business').lean();
    if (viewer?.business && String(viewer.business) === String(biz._id)) return;
  }

  const ipHash = hashIp(req.ip);
  const since = new Date(Date.now() - VIEW_DEDUPE_WINDOW_MS);
  const recent = await ProfileView.findOne({ business: biz._id, ipHash, viewedAt: { $gte: since } }).lean();
  if (recent) return;

  await ProfileView.create({ business: biz._id, ipHash });
}

router.get(
  '/businesses/:id/reviews',
  asyncHandler(async (req, res) => {
    const reviews = await Review.find({
      business: req.params.id,
      status: 'PUBLISHED',
      'dispute.status': { $ne: 'OPEN' },
    })
      .populate('client', 'name')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ reviews });
  })
);

router.get(
  '/businesses/:id/availability',
  asyncHandler(async (req, res) => {
    const { serviceId, date } = req.query;
    if (typeof serviceId !== 'string' || typeof date !== 'string' || !DATE_RE.test(date)) {
      return res.status(400).json({ error: 'INVALID_INPUT' });
    }

    const service = await Service.findOne({ _id: serviceId, business: req.params.id, active: true }).lean();
    if (!service) return res.status(404).json({ error: 'NOT_FOUND' });

    const business = await Business.findById(req.params.id).lean();
    if (!business) return res.status(404).json({ error: 'NOT_FOUND' });

    const staffIds = service.staff?.length ? service.staff : null;
    const staffFilter = { business: req.params.id, active: true, virtual: { $ne: true } };
    if (staffIds) staffFilter._id = { $in: staffIds };
    let staffList = await Staff.find(staffFilter).lean();
    if (!staffList.length && !staffIds) staffList = [(await getOrCreateVirtualStaff(business)).toObject()];

    const slotToStaff = new Map();
    for (const staff of staffList) {
      const slots = await computeFreeSlots({ staff, date, durationMinutes: service.durationMinutes });
      for (const time of slots) {
        if (!slotToStaff.has(time)) slotToStaff.set(time, staff._id);
      }
    }

    const slots = [...slotToStaff.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([time, staffId]) => ({ time, staffId }));

    res.json({ date, slots });
  })
);

// Availability for a multi-service checkout (e.g. manicure + brows back-to-back with
// the same master). Treats the whole combo as one contiguous block — a staff member is
// only offered as a slot if they can perform every requested service AND are free for
// the full combined duration — since a client picking multiple services expects one
// master, one visit, no gaps.
router.get(
  '/businesses/:id/availability-multi',
  asyncHandler(async (req, res) => {
    const { date } = req.query;
    const serviceIds = typeof req.query.serviceIds === 'string' ? req.query.serviceIds.split(',').filter(Boolean) : [];
    if (!serviceIds.length || serviceIds.length > 20 || typeof date !== 'string' || !DATE_RE.test(date)) {
      return res.status(400).json({ error: 'INVALID_INPUT' });
    }

    // serviceIds may repeat the same id (booking one service multiple times, e.g. a
    // sauna for 3 hours instead of 1) — $in dedupes automatically, so validate and sum
    // durations against the unique id set, then re-expand via the lookup map for the
    // duration total so each repeated instance is actually counted.
    const uniqueIds = [...new Set(serviceIds)];
    const services = await Service.find({ _id: { $in: uniqueIds }, business: req.params.id, active: true }).lean();
    if (services.length !== uniqueIds.length) return res.status(404).json({ error: 'NOT_FOUND' });

    const serviceById = new Map(services.map((s) => [String(s._id), s]));
    const totalDuration = serviceIds.reduce((sum, id) => sum + serviceById.get(id).durationMinutes, 0);

    const business = await Business.findById(req.params.id).lean();
    if (!business) return res.status(404).json({ error: 'NOT_FOUND' });

    // A service with an empty staff list means "any active staff can do it" — only
    // intersect down for services that actually restrict who can perform them.
    let eligibleStaffIds = null;
    for (const s of services) {
      if (!s.staff?.length) continue;
      const set = new Set(s.staff.map(String));
      eligibleStaffIds = eligibleStaffIds ? eligibleStaffIds.filter((id) => set.has(id)) : s.staff.map(String);
    }

    const staffFilter = { business: req.params.id, active: true, virtual: { $ne: true } };
    if (eligibleStaffIds) staffFilter._id = { $in: eligibleStaffIds };
    let staffList = await Staff.find(staffFilter).lean();
    if (!staffList.length && !eligibleStaffIds) staffList = [(await getOrCreateVirtualStaff(business)).toObject()];

    const slotToStaff = new Map();
    for (const staff of staffList) {
      const slots = await computeFreeSlots({ staff, date, durationMinutes: totalDuration });
      for (const time of slots) {
        if (!slotToStaff.has(time)) slotToStaff.set(time, staff._id);
      }
    }

    const slots = [...slotToStaff.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([time, staffId]) => ({ time, staffId }));

    res.json({ date, slots, totalDuration });
  })
);

module.exports = router;
