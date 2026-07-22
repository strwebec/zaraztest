const express = require('express');
const bcrypt = require('bcrypt');

const Business = require('../models/Business');
const User = require('../models/User');
const Booking = require('../models/Booking');
const Review = require('../models/Review');
const Service = require('../models/Service');
const Staff = require('../models/Staff');
const Category = require('../models/Category');
const City = require('../models/City');
const TopPlacement = require('../models/TopPlacement');
const Invoice = require('../models/Invoice');
const PlatformSettings = require('../models/PlatformSettings');
const Notification = require('../models/Notification');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { requirePermission, hasAdminPermission } = require('../middleware/adminPermission');
const { PERMISSION_BUCKETS } = require('../models/User');
const { adminLimiter } = require('../middleware/rateLimit');
const { asyncHandler } = require('../utils/asyncHandler');
const { runDailyRatingUpdate } = require('../jobs/dailyRatingUpdate');
const { runMonthlyInvoices } = require('../jobs/monthlyInvoices');
const { runDailySweep } = require('../jobs/autoUnblock');
const { runSheetsSync } = require('../jobs/sheetsSync');
const { recomputeBusinessReviewStats } = require('../utils/reviewStats');
const { computeBusinessRating } = require('../utils/businessRating');
const { sendMail } = require('../utils/mailer');
const { escapeHtml } = require('../utils/escapeHtml');
const { logAdminAction } = require('../utils/auditLog');
const { customCategorySlug, customCitySlug } = require('../utils/slugify');
const { findDuplicateCategory } = require('../utils/categoryDedup');
const { findExistingCity } = require('../utils/cityFromInput');
const AdminAuditLog = require('../models/AdminAuditLog');
const PlatformMetricDefinition = require('../models/PlatformMetricDefinition');
const MonthlyPlatformLedgerEntry = require('../models/MonthlyPlatformLedgerEntry');
const { encryptValue } = require('../utils/ledgerCrypto');
const { computeMonthMetrics: computePlatformMonthMetrics } = require('../utils/platformLedgerCalc');
const { buildInsights: buildPlatformInsights, buildPeriodInsights: buildPlatformPeriodInsights } = require('../utils/platformLedgerInsights');
const crypto = require('crypto');

const router = express.Router();

// Any admin-family role may enter the /admin API; individual routes below
// narrow further down to whichever specific permission bucket they act on
// (requirePermission), which is what actually decides ADMIN-role access.
router.use(requireAuth, requireRole('SUPER_ADMIN', 'MODERATOR', 'FINANCE_ADMIN', 'ADMIN'), adminLimiter);

const onlySuperAdmin = requireRole('SUPER_ADMIN');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVITABLE_ROLES = ['MODERATOR', 'FINANCE_ADMIN', 'ADMIN'];

// Neither bucket alone should imply the other — a MODERATOR (has 'businesses')
// must not see financial totals, and a FINANCE_ADMIN (has only 'finance') must
// not see business/client counts. Both dashboards mirror the same
// conditionally-zeroed pattern already used by /pending-counts below, rather
// than a hard 403, so each admin role still gets a working dashboard scoped to
// whatever it's actually allowed to see.
function requireOverviewAccess(req, res, next) {
  const canBusinesses = hasAdminPermission(req.userRole, req.userPermissions, 'businesses');
  const canFinance = hasAdminPermission(req.userRole, req.userPermissions, 'finance');
  if (!canBusinesses && !canFinance) return res.status(403).json({ error: 'FORBIDDEN' });
  req.canBusinesses = canBusinesses;
  req.canFinance = canFinance;
  next();
}

router.get(
  '/overview',
  requireOverviewAccess,
  asyncHandler(async (req, res) => {
    const monthStart = `${new Date().toISOString().slice(0, 7)}-01`;
    const { canBusinesses, canFinance } = req;

    const [activeBusinesses, pendingBusinesses, clients, completedBookingsCount, monthBookings] = await Promise.all([
      canBusinesses ? Business.countDocuments({ status: 'ACTIVE' }) : Promise.resolve(0),
      canBusinesses ? Business.countDocuments({ status: 'PENDING' }) : Promise.resolve(0),
      canBusinesses ? User.countDocuments({ role: 'CLIENT' }) : Promise.resolve(0),
      canBusinesses ? Booking.countDocuments({ status: 'completed' }) : Promise.resolve(0),
      // "Platform revenue" on the dashboard is the current month's commission, not an
      // all-time cumulative total — an ever-growing lifetime figure reads as frozen
      // month to month even while money is actively coming in. For other periods, the
      // admin uses Analytics, which already breaks revenue down by any date range.
      canFinance
        ? Booking.find({ status: 'completed', date: { $gte: monthStart } }).select('price commissionRate').lean()
        : Promise.resolve([]),
    ]);

    const platformRevenue = monthBookings.reduce((sum, b) => sum + b.price * (b.commissionRate ?? 0), 0);

    res.json({
      activeBusinesses,
      pendingBusinesses,
      clients,
      completedBookingsCount,
      platformRevenue,
    });
  })
);

const ANALYTICS_RANGES = [7, 30, 90];

router.get(
  '/analytics',
  requireOverviewAccess,
  asyncHandler(async (req, res) => {
    const { canBusinesses, canFinance } = req;
    const requestedDays = Number(req.query.days);
    const rangeDays = ANALYTICS_RANGES.includes(requestedDays) ? requestedDays : 30;

    const todayKey = new Date().toISOString().slice(0, 10);
    const since = new Date(Date.now() - (rangeDays - 1) * 24 * 60 * 60 * 1000);
    const sinceKey = since.toISOString().slice(0, 10);

    const currentMonth = todayKey.slice(0, 7);

    const [newBusinesses, newClients, completedBookings, categoryAgg, outstandingAgg, paidThisMonthAgg, overdueCount, topBusinessesAgg] = await Promise.all([
      canBusinesses ? Business.find({ createdAt: { $gte: since } }).select('createdAt').lean() : Promise.resolve([]),
      canBusinesses ? User.find({ role: 'CLIENT', createdAt: { $gte: since } }).select('createdAt').lean() : Promise.resolve([]),
      Booking.find({ status: 'completed', date: { $gte: sinceKey, $lte: todayKey } })
        .select('date price commissionRate')
        .lean(),
      canBusinesses ? Business.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]) : Promise.resolve([]),
      canFinance
        ? Invoice.aggregate([
            { $match: { status: { $in: ['PENDING', 'AWAITING_VERIFICATION', 'OVERDUE'] } } },
            { $group: { _id: null, total: { $sum: '$totalCommission' } } },
          ])
        : Promise.resolve([]),
      canFinance
        ? Invoice.aggregate([
            { $match: { status: 'PAID', month: currentMonth } },
            { $group: { _id: null, total: { $sum: '$totalCommission' } } },
          ])
        : Promise.resolve([]),
      canFinance ? Invoice.countDocuments({ status: 'OVERDUE' }) : Promise.resolve(0),
      canFinance
        ? Booking.aggregate([
            { $match: { status: 'completed', date: { $gte: sinceKey, $lte: todayKey } } },
            {
              $group: {
                _id: '$business',
                bookings: { $sum: 1 },
                revenue: { $sum: { $multiply: ['$price', { $ifNull: ['$commissionRate', 0] }] } },
              },
            },
            { $sort: { revenue: -1 } },
            { $limit: 8 },
            { $lookup: { from: 'businesses', localField: '_id', foreignField: '_id', as: 'business' } },
            { $unwind: '$business' },
            { $project: { name: '$business.name', bookings: 1, revenue: 1 } },
          ])
        : Promise.resolve([]),
    ]);

    const byDay = new Map();
    for (let i = 0; i < rangeDays; i++) {
      const key = new Date(since.getTime() + i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      byDay.set(key, { date: key, newBusinesses: 0, newClients: 0, completedBookings: 0, revenue: 0 });
    }

    for (const biz of newBusinesses) {
      const key = new Date(biz.createdAt).toISOString().slice(0, 10);
      const bucket = byDay.get(key);
      if (bucket) bucket.newBusinesses += 1;
    }
    for (const user of newClients) {
      const key = new Date(user.createdAt).toISOString().slice(0, 10);
      const bucket = byDay.get(key);
      if (bucket) bucket.newClients += 1;
    }
    for (const b of completedBookings) {
      const bucket = byDay.get(b.date);
      if (bucket) {
        if (canBusinesses) bucket.completedBookings += 1;
        if (canFinance) bucket.revenue += b.price * (b.commissionRate ?? 0);
      }
    }

    const categoryBreakdown = categoryAgg.map((c) => ({ category: c._id, count: c.count }));
    const topBusinesses = topBusinessesAgg.map((b) => ({ name: b.name, bookings: b.bookings, revenue: b.revenue }));

    const totalGMV = canFinance ? completedBookings.reduce((sum, b) => sum + b.price, 0) : 0;
    const totalPlatformRevenue = canFinance
      ? completedBookings.reduce((sum, b) => sum + b.price * (b.commissionRate ?? 0), 0)
      : 0;

    res.json({
      daily: [...byDay.values()],
      categoryBreakdown,
      topBusinesses,
      summary: {
        totalGMV: Math.round(totalGMV),
        totalPlatformRevenue: Math.round(totalPlatformRevenue),
        outstandingInvoices: Math.round(outstandingAgg[0]?.total ?? 0),
        paidThisMonth: Math.round(paidThisMonthAgg[0]?.total ?? 0),
        overdueCount,
      },
    });
  })
);

router.get(
  '/businesses',
  requirePermission('businesses'),
  asyncHandler(async (req, res) => {
    const { status } = req.query;
    const filter = {};
    if (typeof status === 'string' && status) filter.status = status;

    const businesses = await Business.find(filter)
      .populate('owner', 'name email')
      .populate('city', 'name')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ businesses: businesses.map((b) => ({ ...b, rating: computeBusinessRating(b) })) });
  })
);

router.get(
  '/businesses/:id',
  requirePermission('businesses'),
  asyncHandler(async (req, res) => {
    const business = await Business.findById(req.params.id)
      .populate('owner', 'name email phone')
      .populate('city', 'name')
      .lean();
    if (!business) return res.status(404).json({ error: 'NOT_FOUND' });

    const [servicesCount, staffCount, completedBookings, revenueAgg] = await Promise.all([
      Service.countDocuments({ business: business._id, active: true }),
      Staff.countDocuments({ business: business._id, active: true, virtual: { $ne: true } }),
      Booking.countDocuments({ business: business._id, status: 'completed' }),
      Booking.aggregate([
        { $match: { business: business._id, status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$price' } } },
      ]),
    ]);

    res.json({
      business: { ...business, rating: computeBusinessRating(business) },
      stats: {
        servicesCount,
        staffCount,
        completedBookings,
        totalRevenue: revenueAgg[0]?.total ?? 0,
      },
    });
  })
);

router.post(
  '/businesses/:id/approve',
  requirePermission('businesses'),
  asyncHandler(async (req, res) => {
    const business = await Business.findByIdAndUpdate(
      req.params.id,
      { status: 'ACTIVE', rejectionReason: undefined },
      { new: true }
    );
    if (!business) return res.status(404).json({ error: 'NOT_FOUND' });
    // A city registered via the "type your own" flow (utils/cityFromInput.js) starts
    // inactive — approving its first business is the only signal that makes it a real,
    // searchable city, with no separate manual "add city" step for the super-admin.
    if (business.city) await City.updateOne({ _id: business.city, active: false }, { active: true });
    await logAdminAction(req, { action: 'business.approve', targetType: 'Business', targetId: business._id, targetLabel: business.name });
    res.json({ business });
  })
);

router.post(
  '/businesses/:id/reject',
  requirePermission('businesses'),
  asyncHandler(async (req, res) => {
    const { reason } = req.body || {};
    const business = await Business.findByIdAndUpdate(
      req.params.id,
      { status: 'BLOCKED', rejectionReason: typeof reason === 'string' && reason.trim() ? reason.trim() : undefined },
      { new: true }
    );
    if (!business) return res.status(404).json({ error: 'NOT_FOUND' });
    await logAdminAction(req, { action: 'business.reject', targetType: 'Business', targetId: business._id, targetLabel: business.name, meta: { reason } });
    res.json({ business });
  })
);

router.post(
  '/businesses/:id/block',
  requirePermission('businesses'),
  asyncHandler(async (req, res) => {
    const { reason, durationDays } = req.body || {};
    const days = Number(durationDays);
    const blockReason = typeof reason === 'string' && reason.trim() ? reason.trim() : undefined;
    const blockedUntil = Number.isFinite(days) && days > 0 ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : undefined;

    const setFields = { status: 'BLOCKED' };
    const unsetFields = {};
    if (blockReason) setFields.blockReason = blockReason;
    else unsetFields.blockReason = 1;
    if (blockedUntil) setFields.blockedUntil = blockedUntil;
    else unsetFields.blockedUntil = 1;

    const business = await Business.findByIdAndUpdate(
      req.params.id,
      { $set: setFields, ...(Object.keys(unsetFields).length ? { $unset: unsetFields } : {}) },
      { new: true }
    );
    if (!business) return res.status(404).json({ error: 'NOT_FOUND' });
    await logAdminAction(req, {
      action: 'business.block',
      targetType: 'Business',
      targetId: business._id,
      targetLabel: business.name,
      meta: { reason: blockReason, durationDays: Number.isFinite(days) && days > 0 ? days : null },
    });
    res.json({ business });
  })
);

router.post(
  '/businesses/:id/unblock',
  requirePermission('businesses'),
  asyncHandler(async (req, res) => {
    const business = await Business.findByIdAndUpdate(
      req.params.id,
      { status: 'ACTIVE', $unset: { blockedUntil: 1, blockReason: 1 } },
      { new: true }
    );
    if (!business) return res.status(404).json({ error: 'NOT_FOUND' });
    await logAdminAction(req, { action: 'business.unblock', targetType: 'Business', targetId: business._id, targetLabel: business.name });
    res.json({ business });
  })
);

// Lets a super-admin activate TOP placement for a business directly, bypassing the
// purchase/payment-confirmation flow entirely (e.g. as a goodwill gesture or a promo) —
// creates a TopPlacement record for the history/audit trail same as a paid one, just
// already CONFIRMED with amount 0.
router.post(
  '/businesses/:id/grant-top',
  requirePermission('businesses'),
  asyncHandler(async (req, res) => {
    const { durationDays } = req.body || {};
    const days = Number(durationDays);
    if (!Number.isFinite(days) || days <= 0 || days > 365) {
      return res.status(400).json({ error: 'INVALID_INPUT' });
    }

    const business = await Business.findById(req.params.id);
    if (!business) return res.status(404).json({ error: 'NOT_FOUND' });

    const confirmedAt = new Date();
    const expiresAt = new Date(confirmedAt.getTime() + days * 24 * 60 * 60 * 1000);

    const placement = await TopPlacement.create({
      business: business._id,
      package: 'admin_grant',
      amount: 0,
      durationDays: days,
      status: 'CONFIRMED',
      requestedAt: confirmedAt,
      confirmedAt,
      expiresAt,
    });

    business.top = { active: true, until: expiresAt };
    await business.save();

    await logAdminAction(req, {
      action: 'business.grantTop',
      targetType: 'Business',
      targetId: business._id,
      targetLabel: business.name,
      meta: { durationDays: days, expiresAt },
    });

    res.status(201).json({ business, placement });
  })
);

// Ends a business's current TOP placement immediately, whether it was granted for
// free or paid for — mirrors grant-top rather than deleting history: the most recent
// CONFIRMED placement's expiresAt is pulled back to now instead of being erased, so
// it still shows accurately in the business's TOP-placement history afterward.
router.post(
  '/businesses/:id/revoke-top',
  requirePermission('businesses'),
  asyncHandler(async (req, res) => {
    const business = await Business.findById(req.params.id);
    if (!business) return res.status(404).json({ error: 'NOT_FOUND' });

    const now = new Date();
    const activePlacement = await TopPlacement.findOne({
      business: business._id,
      status: 'CONFIRMED',
      expiresAt: { $gt: now },
    }).sort({ expiresAt: -1 });
    if (activePlacement) {
      activePlacement.expiresAt = now;
      await activePlacement.save();
    }

    business.top = { active: false };
    await business.save();

    await logAdminAction(req, {
      action: 'business.revokeTop',
      targetType: 'Business',
      targetId: business._id,
      targetLabel: business.name,
    });

    res.json({ business });
  })
);

// Permanent delete — SUPER_ADMIN only. Refuses if the business still has upcoming
// confirmed bookings, so an admin can't silently erase appointments clients are
// still expecting; block the business first to let those play out or be cancelled.
router.delete(
  '/businesses/:id',
  onlySuperAdmin,
  asyncHandler(async (req, res) => {
    const business = await Business.findById(req.params.id);
    if (!business) return res.status(404).json({ error: 'NOT_FOUND' });

    const todayKey = new Date().toISOString().slice(0, 10);
    const hasUpcomingBookings = await Booking.exists({
      business: business._id,
      status: 'confirmed',
      date: { $gte: todayKey },
    });
    if (hasUpcomingBookings) return res.status(409).json({ error: 'HAS_UPCOMING_BOOKINGS' });

    await Promise.all([
      Service.deleteMany({ business: business._id }),
      Staff.deleteMany({ business: business._id }),
      TopPlacement.deleteMany({ business: business._id }),
      Business.deleteOne({ _id: business._id }),
    ]);
    await User.updateOne({ _id: business.owner }, { $unset: { business: 1 } });
    await logAdminAction(req, { action: 'business.delete', targetType: 'Business', targetId: business._id, targetLabel: business.name });

    res.json({ ok: true });
  })
);

router.get(
  '/reviews',
  requirePermission('reviews'),
  asyncHandler(async (req, res) => {
    const { status, flaggedReplies } = req.query;
    const filter = {};
    if (flaggedReplies === 'true') {
      filter.replyFlagged = true;
    } else if (status === 'DISPUTED') {
      filter['dispute.status'] = 'OPEN';
    } else {
      filter.status = typeof status === 'string' && status ? status : 'PENDING';
    }

    const reviews = await Review.find(filter)
      .populate('client', 'name')
      .populate('business', 'name')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ reviews });
  })
);

router.post(
  '/reviews/:id/approve',
  requirePermission('reviews'),
  asyncHandler(async (req, res) => {
    const review = await Review.findByIdAndUpdate(req.params.id, { status: 'PUBLISHED' }, { new: true });
    if (!review) return res.status(404).json({ error: 'NOT_FOUND' });
    await recomputeBusinessReviewStats(review.business);
    res.json({ review });
  })
);

router.post(
  '/reviews/:id/reject',
  requirePermission('reviews'),
  asyncHandler(async (req, res) => {
    const review = await Review.findByIdAndUpdate(req.params.id, { status: 'REJECTED' }, { new: true });
    if (!review) return res.status(404).json({ error: 'NOT_FOUND' });
    await recomputeBusinessReviewStats(review.business);
    res.json({ review });
  })
);

router.post(
  '/reviews/:id/dispute-resolve',
  requirePermission('reviews'),
  asyncHandler(async (req, res) => {
    const { decision, note } = req.body || {};
    if (decision !== 'UPHELD' && decision !== 'DISMISSED') {
      return res.status(400).json({ error: 'INVALID_INPUT' });
    }

    const review = await Review.findById(req.params.id).populate('business', 'name owner').populate('client', 'name');
    if (!review) return res.status(404).json({ error: 'NOT_FOUND' });
    if (review.dispute?.status !== 'OPEN') return res.status(400).json({ error: 'NO_OPEN_DISPUTE' });

    review.dispute.status = decision;
    review.dispute.resolution = typeof note === 'string' && note.trim() ? note.trim() : undefined;
    review.dispute.resolvedAt = new Date();
    review.dispute.resolvedBy = req.userId;
    // UPHELD means the business's challenge won — the review is unfair and stays
    // hidden going forward, same as a moderation rejection. DISMISSED means the review
    // stands; its status was never changed, so it simply becomes visible again.
    if (decision === 'UPHELD') review.status = 'REJECTED';
    await review.save();

    await recomputeBusinessReviewStats(review.business._id);

    await logAdminAction(req, {
      action: 'review.disputeResolve',
      targetType: 'Review',
      targetId: review._id,
      targetLabel: review.business.name,
    });

    if (review.business?.owner) {
      await Notification.create({
        user: review.business.owner,
        type: 'review_dispute_resolved',
        title: decision === 'UPHELD' ? 'Спір по відгуку задоволено' : 'Спір по відгуку відхилено',
        text:
          decision === 'UPHELD'
            ? 'Адміністрація визнала ваше оскарження обґрунтованим — відгук приховано.'
            : 'Адміністрація розглянула ваше оскарження та залишила відгук без змін.',
        relatedReview: review._id,
      });
    }
    if (review.client) {
      await Notification.create({
        user: review.client._id,
        type: 'review_dispute_resolved',
        title: decision === 'UPHELD' ? 'Ваш відгук приховано' : 'Ваш відгук залишився опублікованим',
        text:
          decision === 'UPHELD'
            ? `${review.business.name} оскаржив ваш відгук, і адміністрація визнала оскарження обґрунтованим.`
            : `${review.business.name} оскаржив ваш відгук, але адміністрація залишила його без змін.`,
        relatedReview: review._id,
      });
    }

    res.json({ review });
  })
);

router.post(
  '/reviews/:id/clear-reply-flag',
  requirePermission('reviews'),
  asyncHandler(async (req, res) => {
    const review = await Review.findByIdAndUpdate(req.params.id, { replyFlagged: false }, { new: true });
    if (!review) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json({ review });
  })
);

router.post(
  '/reviews/:id/remove-reply',
  requirePermission('reviews'),
  asyncHandler(async (req, res) => {
    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { reply: { text: undefined, repliedAt: undefined }, replyFlagged: false },
      { new: true }
    );
    if (!review) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json({ review });
  })
);

router.get(
  '/top-placements',
  requirePermission('topPlacements'),
  asyncHandler(async (req, res) => {
    const { status, business } = req.query;
    const filter = {};
    if (typeof business === 'string' && business) {
      // Scoped to one business (from its detail page) — show its full history, not
      // just the default pending-review filter.
      filter.business = business;
      if (typeof status === 'string' && status) filter.status = status;
    } else {
      filter.status = typeof status === 'string' && status ? status : 'PENDING';
    }

    const placements = await TopPlacement.find(filter)
      .populate('business', 'name category')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ placements });
  })
);

router.post(
  '/top-placements/:id/confirm',
  requirePermission('topPlacements'),
  asyncHandler(async (req, res) => {
    // Admin can fast-track activation once the business has confirmed payment
    // (AWAITING_ACTIVATION), instead of waiting for the 15-minute auto-activation timer.
    // durationDays never changes after creation, so reading it separately from the
    // atomic status flip below is safe — it's the status transition itself that's racy
    // against the topPlacementActivation cron, which can fire on the same document at
    // the same moment. A plain findOne+save here would let both this route and the
    // cron read status:'AWAITING_ACTIVATION' before either writes, double-firing the
    // audit log and business update; the status:'AWAITING_ACTIVATION' filter on the
    // update itself guarantees only one of them ever wins.
    const existing = await TopPlacement.findOne({ _id: req.params.id, status: 'AWAITING_ACTIVATION' })
      .select('durationDays')
      .lean();
    if (!existing) return res.status(404).json({ error: 'NOT_FOUND' });

    const confirmedAt = new Date();
    const expiresAt = new Date(confirmedAt.getTime() + existing.durationDays * 24 * 60 * 60 * 1000);

    const placement = await TopPlacement.findOneAndUpdate(
      { _id: req.params.id, status: 'AWAITING_ACTIVATION' },
      { status: 'CONFIRMED', confirmedAt, expiresAt },
      { new: true }
    );
    if (!placement) return res.status(409).json({ error: 'ALREADY_PROCESSED' });

    await Business.updateOne({ _id: placement.business }, { top: { active: true, until: expiresAt } });
    await logAdminAction(req, { action: 'topPlacement.confirm', targetType: 'TopPlacement', targetId: placement._id, meta: { business: placement.business } });

    res.json({ placement });
  })
);

router.post(
  '/top-placements/:id/reject',
  requirePermission('topPlacements'),
  asyncHandler(async (req, res) => {
    const { reason } = req.body || {};
    const placement = await TopPlacement.findOneAndUpdate(
      { _id: req.params.id, status: { $in: ['PENDING', 'AWAITING_ACTIVATION'] } },
      { status: 'REJECTED', rejectionReason: typeof reason === 'string' && reason.trim() ? reason.trim() : undefined },
      { new: true }
    );
    if (!placement) return res.status(404).json({ error: 'NOT_FOUND' });
    await logAdminAction(req, { action: 'topPlacement.reject', targetType: 'TopPlacement', targetId: placement._id, meta: { business: placement.business, reason } });
    res.json({ placement });
  })
);

router.get(
  '/settings/requisites',
  requirePermission('finance'),
  asyncHandler(async (req, res) => {
    const settings = await PlatformSettings.getOrCreate();
    res.json({
      commissionRequisites: settings.commissionRequisites,
      topPlacementRequisites: settings.topPlacementRequisites,
    });
  })
);

router.patch(
  '/settings/requisites',
  requirePermission('finance'),
  asyncHandler(async (req, res) => {
    const { commissionRequisites, topPlacementRequisites } = req.body || {};
    const update = { updatedBy: req.userId };
    if (typeof commissionRequisites === 'string') update.commissionRequisites = commissionRequisites;
    if (typeof topPlacementRequisites === 'string') update.topPlacementRequisites = topPlacementRequisites;

    await PlatformSettings.getOrCreate();
    const settings = await PlatformSettings.findByIdAndUpdate('default', update, { new: true });
    await logAdminAction(req, { action: 'settings.updateRequisites', targetType: 'PlatformSettings', targetId: 'default', targetLabel: 'Payment requisites' });
    res.json({
      commissionRequisites: settings.commissionRequisites,
      topPlacementRequisites: settings.topPlacementRequisites,
    });
  })
);

router.get(
  '/finance/overview',
  requirePermission('finance'),
  asyncHandler(async (req, res) => {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [overdueAgg, pendingAgg, collectedAgg] = await Promise.all([
      Invoice.aggregate([
        { $match: { status: { $in: ['OVERDUE', 'BLOCKED'] } } },
        { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$totalCommission' } } },
      ]),
      Invoice.aggregate([
        { $match: { status: { $in: ['PENDING', 'AWAITING_VERIFICATION'] } } },
        { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$totalCommission' } } },
      ]),
      Invoice.aggregate([
        { $match: { status: 'PAID', paidAt: { $gte: monthStart } } },
        { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$totalCommission' } } },
      ]),
    ]);

    const pick = (agg) => ({ count: agg[0]?.count ?? 0, total: agg[0]?.total ?? 0 });
    res.json({
      overdue: pick(overdueAgg),
      pending: pick(pendingAgg),
      collectedThisMonth: pick(collectedAgg),
    });
  })
);

// Powers the sidebar badges — a single lightweight call instead of three separate
// list fetches just to size a number. Counts reflect exactly what moves an item out
// of the reviewer's queue (approve/reject/confirm), so the badge disappears the
// moment it's actually resolved, not just glanced at.
router.get(
  '/pending-counts',
  asyncHandler(async (req, res) => {
    // Mirrors the permission boundaries on the underlying list endpoints below —
    // a user without the 'businesses'/'topPlacements'/'finance' bucket shouldn't
    // learn even the count of items in that queue.
    const canBusinesses = hasAdminPermission(req.userRole, req.userPermissions, 'businesses');
    const canTopPlacements = hasAdminPermission(req.userRole, req.userPermissions, 'topPlacements');
    const canFinance = hasAdminPermission(req.userRole, req.userPermissions, 'finance');

    const [pendingBusinesses, pendingTopPlacements, pendingInvoices] = await Promise.all([
      canBusinesses ? Business.countDocuments({ status: 'PENDING' }) : Promise.resolve(0),
      canTopPlacements ? TopPlacement.countDocuments({ status: 'AWAITING_ACTIVATION' }) : Promise.resolve(0),
      canFinance ? Invoice.countDocuments({ status: 'AWAITING_VERIFICATION' }) : Promise.resolve(0),
    ]);
    res.json({ pendingBusinesses, pendingTopPlacements, pendingInvoices });
  })
);

router.get(
  '/invoices',
  requirePermission('finance'),
  asyncHandler(async (req, res) => {
    const { status, business } = req.query;
    const filter = {};
    if (typeof business === 'string' && business) {
      // Scoped to one business (from its detail page) — show its full history, not
      // just the default status filter.
      filter.business = business;
      if (typeof status === 'string' && status) filter.status = status;
    } else if (typeof status === 'string' && status) {
      filter.status = status;
    }

    const invoices = await Invoice.find(filter).populate('business', 'name').sort({ issuedAt: -1 }).lean();
    res.json({ invoices });
  })
);

// A one-off invoice for a specific business, separate from the automatic monthly
// commission run (jobs/monthlyInvoices.js) — e.g. a manual adjustment or a charge
// unrelated to booking commissions. Shares the same status lifecycle and the
// business's existing confirm-payment + receipt-upload flow (POST
// /business/invoices/:id/confirm-payment) and this router's mark-paid/reject-receipt
// routes above/below untouched — nothing there distinguishes invoice type.
router.post(
  '/invoices',
  requirePermission('finance'),
  asyncHandler(async (req, res) => {
    const { businessId, amount, description } = req.body || {};
    if (
      typeof businessId !== 'string' ||
      typeof amount !== 'number' ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      typeof description !== 'string' ||
      !description.trim()
    ) {
      return res.status(400).json({ error: 'INVALID_INPUT' });
    }

    const business = await Business.findById(businessId);
    if (!business) return res.status(404).json({ error: 'NOT_FOUND' });

    const issuedAt = new Date();
    const dueAt = new Date(issuedAt.getTime() + 7 * 24 * 60 * 60 * 1000);
    const trimmedDescription = description.trim();
    const totalCommission = Math.round(amount * 100) / 100;

    const invoice = await Invoice.create({
      business: business._id,
      type: 'MANUAL',
      description: trimmedDescription,
      month: issuedAt.toISOString().slice(0, 7),
      items: [],
      totalCommission,
      status: 'PENDING',
      issuedAt,
      dueAt,
    });

    const owner = await User.findById(business.owner).lean();
    if (owner) {
      await sendMail({
        to: owner.email,
        subject: 'Новий рахунок — ZARAZ',
        html: `Вам виставлено рахунок: ${escapeHtml(trimmedDescription)} — ${totalCommission}₴. Оплатіть протягом 7 днів у кабінеті бізнесу (розділ "Рахунки").`,
      });
    }

    await logAdminAction(req, {
      action: 'invoice.createManual',
      targetType: 'Invoice',
      targetId: invoice._id,
      targetLabel: business.name,
      meta: { amount: totalCommission, description: trimmedDescription },
    });

    res.status(201).json({ invoice });
  })
);

router.post(
  '/invoices/:id/mark-paid',
  requirePermission('finance'),
  asyncHandler(async (req, res) => {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'NOT_FOUND' });
    if (invoice.status === 'PAID') return res.status(400).json({ error: 'ALREADY_PAID' });

    invoice.status = 'PAID';
    invoice.paidAt = new Date();
    const latestReceipt = invoice.receiptHistory[invoice.receiptHistory.length - 1];
    if (latestReceipt && latestReceipt.status === 'PENDING_REVIEW') {
      latestReceipt.status = 'ACCEPTED';
      latestReceipt.resolvedAt = invoice.paidAt;
    }
    await invoice.save();

    const business = await Business.findById(invoice.business);
    if (business) {
      business.billing.status = 'CURRENT';
      business.billing.unpaidSince = undefined;
      if (business.status === 'HIDDEN' || business.status === 'BLOCKED') business.status = 'ACTIVE';
      await business.save();
    }
    await logAdminAction(req, { action: 'invoice.markPaid', targetType: 'Invoice', targetId: invoice._id, meta: { business: invoice.business, amount: invoice.totalCommission } });

    res.json({ invoice });
  })
);

// Rejects a submitted receipt (e.g. suspected forgery) and reverts the invoice to
// its prior escalation state so the business can resubmit. See the platform's
// consent/privacy policy on submitting falsified payment proof.
router.post(
  '/invoices/:id/reject-receipt',
  requirePermission('finance'),
  asyncHandler(async (req, res) => {
    const { reason } = req.body || {};
    const invoice = await Invoice.findOne({ _id: req.params.id, status: 'AWAITING_VERIFICATION' });
    if (!invoice) return res.status(404).json({ error: 'NOT_FOUND' });

    const daysSinceIssued = (Date.now() - new Date(invoice.issuedAt).getTime()) / (24 * 60 * 60 * 1000);
    const trimmedReason = typeof reason === 'string' && reason.trim() ? reason.trim() : undefined;
    invoice.status = daysSinceIssued >= 8 ? 'OVERDUE' : 'PENDING';
    invoice.receiptRejectedReason = trimmedReason;
    const latestReceipt = invoice.receiptHistory[invoice.receiptHistory.length - 1];
    if (latestReceipt && latestReceipt.status === 'PENDING_REVIEW') {
      latestReceipt.status = 'REJECTED';
      latestReceipt.rejectedReason = trimmedReason;
      latestReceipt.resolvedAt = new Date();
    }
    await invoice.save();
    await logAdminAction(req, { action: 'invoice.rejectReceipt', targetType: 'Invoice', targetId: invoice._id, meta: { business: invoice.business, reason } });

    res.json({ invoice });
  })
);

router.get(
  '/categories',
  requirePermission('categories'),
  asyncHandler(async (req, res) => {
    const { status } = req.query;
    const filter = {};
    if (status === 'ALL') {
      // no filter — every category regardless of status
    } else if (typeof status === 'string' && status) {
      filter.status = status;
    } else {
      filter.status = 'PENDING';
    }

    const categories = await Category.find(filter)
      .populate('requestedByBusiness', 'name')
      .collation({ locale: 'uk', strength: 1 })
      .sort({ name: 1 })
      .lean();
    res.json({ categories });
  })
);

// Lets a super-admin add a category directly (already ACTIVE, immediately usable by
// every business) instead of only ever approving ones a business requested via "Other".
router.post(
  '/categories',
  requirePermission('categories'),
  asyncHandler(async (req, res) => {
    const { name, nameEn } = req.body || {};
    if (typeof name !== 'string' || !name.trim() || typeof nameEn !== 'string' || !nameEn.trim()) {
      return res.status(400).json({ error: 'INVALID_INPUT' });
    }

    const duplicate = (await findDuplicateCategory(name)) || (await findDuplicateCategory(nameEn));
    if (duplicate) return res.status(409).json({ error: 'CATEGORY_ALREADY_EXISTS', category: duplicate });

    const category = await Category.create({
      slug: customCategorySlug(),
      name: name.trim(),
      nameEn: nameEn.trim(),
      status: 'ACTIVE',
    });
    await logAdminAction(req, { action: 'category.create', targetType: 'Category', targetId: category._id, targetLabel: category.name });
    res.status(201).json({ category });
  })
);

// Super-admin only (not the general 'categories' bucket moderators also get) since
// deleting is destructive and irreversible, unlike approve/reject which just toggle
// status. Blocked while any business or service still references the category's slug
// so removing a duplicate can't silently orphan real listings — pass reassignTo (another
// category's id) to bulk-move every business/service off this slug onto the target's
// first, then delete. This is the real fix for duplicate categories that predate the
// dedup check: a business's services can end up scattered across several near-identical
// categories created one at a time before that check existed, so a single-category
// delete alone can't clean that up — every duplicate needs to be merged into the one
// survivor.
router.delete(
  '/categories/:id',
  onlySuperAdmin,
  asyncHandler(async (req, res) => {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ error: 'NOT_FOUND' });

    const { reassignTo } = req.body || {};
    if (typeof reassignTo === 'string' && reassignTo) {
      if (reassignTo === category.slug) return res.status(400).json({ error: 'INVALID_INPUT' });
      const target = await Category.findOne({ slug: reassignTo });
      if (!target) return res.status(404).json({ error: 'REASSIGN_TARGET_NOT_FOUND' });

      const [{ modifiedCount: businessesMoved }, { modifiedCount: servicesMoved }] = await Promise.all([
        Business.updateMany({ category: category.slug }, { $set: { category: target.slug } }),
        Service.updateMany({ category: category.slug }, { $set: { category: target.slug } }),
      ]);
      await category.deleteOne();
      await logAdminAction(req, {
        action: 'category.delete',
        targetType: 'Category',
        targetId: category._id,
        targetLabel: `${category.name} → merged into ${target.name} (${businessesMoved} businesses, ${servicesMoved} services)`,
      });
      return res.json({ ok: true, businessesMoved, servicesMoved });
    }

    const [businessCount, serviceCount] = await Promise.all([
      Business.countDocuments({ category: category.slug }),
      Service.countDocuments({ category: category.slug }),
    ]);
    if (businessCount || serviceCount) {
      return res.status(409).json({ error: 'CATEGORY_IN_USE', businessCount, serviceCount });
    }

    await category.deleteOne();
    await logAdminAction(req, { action: 'category.delete', targetType: 'Category', targetId: category._id, targetLabel: category.name });
    res.json({ ok: true });
  })
);

router.post(
  '/categories/:id/approve',
  requirePermission('categories'),
  asyncHandler(async (req, res) => {
    const category = await Category.findOneAndUpdate(
      { _id: req.params.id, status: 'PENDING' },
      { status: 'ACTIVE' },
      { new: true }
    );
    if (!category) return res.status(404).json({ error: 'NOT_FOUND' });
    await logAdminAction(req, { action: 'category.approve', targetType: 'Category', targetId: category._id, targetLabel: category.name });
    res.json({ category });
  })
);

router.post(
  '/categories/:id/reject',
  requirePermission('categories'),
  asyncHandler(async (req, res) => {
    const category = await Category.findOneAndUpdate(
      { _id: req.params.id, status: 'PENDING' },
      { status: 'REJECTED' },
      { new: true }
    );
    if (!category) return res.status(404).json({ error: 'NOT_FOUND' });
    await logAdminAction(req, { action: 'category.reject', targetType: 'Category', targetId: category._id, targetLabel: category.name });
    res.json({ category });
  })
);

// ---- Cities: manage the list a business/client can register under, and confirm the
// ones auto-created (inactive) via the "type your own city" flow at registration ----

router.get(
  '/cities',
  requirePermission('categories'),
  asyncHandler(async (req, res) => {
    const { status } = req.query;
    const filter = {};
    if (status === 'active') filter.active = true;
    else if (status === 'pending') filter.active = false;
    // status === 'all' or unset — every city regardless of active state

    const cities = await City.find(filter).collation({ locale: 'uk', strength: 1 }).sort({ name: 1 }).lean();
    res.json({ cities });
  })
);

// Lets a super-admin add a city directly (already active, immediately searchable)
// instead of only ever confirming ones created via a business/client registration.
router.post(
  '/cities',
  requirePermission('categories'),
  asyncHandler(async (req, res) => {
    const { name, nameEn } = req.body || {};
    if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'INVALID_INPUT' });

    const duplicate = await findExistingCity(name);
    if (duplicate) return res.status(409).json({ error: 'CITY_ALREADY_EXISTS', city: duplicate });

    const city = await City.create({
      slug: customCitySlug(),
      name: name.trim(),
      nameEn: typeof nameEn === 'string' && nameEn.trim() ? nameEn.trim() : undefined,
      active: true,
    });
    await logAdminAction(req, { action: 'city.create', targetType: 'City', targetId: city._id, targetLabel: city.name });
    res.status(201).json({ city });
  })
);

// Manually confirms a city that's still pending (e.g. a client registered from there
// before any business did) — the same effect business approval already has automatically.
router.post(
  '/cities/:id/approve',
  requirePermission('categories'),
  asyncHandler(async (req, res) => {
    const city = await City.findOneAndUpdate({ _id: req.params.id, active: false }, { active: true }, { new: true });
    if (!city) return res.status(404).json({ error: 'NOT_FOUND' });
    await logAdminAction(req, { action: 'city.approve', targetType: 'City', targetId: city._id, targetLabel: city.name });
    res.json({ city });
  })
);

// Super-admin only, since this is destructive — blocked while any business or user
// still references the city, same safety pattern as category delete.
router.delete(
  '/cities/:id',
  onlySuperAdmin,
  asyncHandler(async (req, res) => {
    const city = await City.findById(req.params.id);
    if (!city) return res.status(404).json({ error: 'NOT_FOUND' });

    const [businessCount, userCount] = await Promise.all([
      Business.countDocuments({ city: city._id }),
      User.countDocuments({ city: city._id }),
    ]);
    if (businessCount || userCount) {
      return res.status(409).json({ error: 'CITY_IN_USE', businessCount, userCount });
    }

    await city.deleteOne();
    await logAdminAction(req, { action: 'city.delete', targetType: 'City', targetId: city._id, targetLabel: city.name });
    res.json({ ok: true });
  })
);

router.get(
  '/users',
  requirePermission('users'),
  asyncHandler(async (req, res) => {
    const { role, q } = req.query;
    const filter = { role: { $in: ['CLIENT', 'BUSINESS_OWNER'] } };
    if (role === 'CLIENT' || role === 'BUSINESS_OWNER') filter.role = role;
    if (typeof q === 'string' && q.trim()) {
      const re = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: re }, { email: re }];
    }

    const users = await User.find(filter)
      .select('name email phone role rating blockedUntil blockReason business createdAt')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    res.json({ users });
  })
);

const FAR_FUTURE = new Date('2999-01-01');

router.post(
  '/users/:id/block',
  requirePermission('users'),
  asyncHandler(async (req, res) => {
    const { reason, durationDays } = req.body || {};
    const days = Number(durationDays);
    const blockReason = typeof reason === 'string' && reason.trim() ? reason.trim() : undefined;
    const blockedUntil = Number.isFinite(days) && days > 0 ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : FAR_FUTURE;

    const setFields = { blockedUntil };
    const unsetFields = {};
    if (blockReason) setFields.blockReason = blockReason;
    else unsetFields.blockReason = 1;

    const user = await User.findOneAndUpdate(
      { _id: req.params.id, role: { $in: ['CLIENT', 'BUSINESS_OWNER'] } },
      { $set: setFields, ...(Object.keys(unsetFields).length ? { $unset: unsetFields } : {}) },
      { new: true }
    );
    if (!user) return res.status(404).json({ error: 'NOT_FOUND' });
    await logAdminAction(req, {
      action: 'user.block',
      targetType: 'User',
      targetId: user._id,
      targetLabel: `${user.name} (${user.email})`,
      meta: { reason: blockReason, durationDays: Number.isFinite(days) && days > 0 ? days : null },
    });
    res.json({ ok: true });
  })
);

router.post(
  '/users/:id/unblock',
  requirePermission('users'),
  asyncHandler(async (req, res) => {
    const user = await User.findOneAndUpdate(
      { _id: req.params.id, role: { $in: ['CLIENT', 'BUSINESS_OWNER'] } },
      { $unset: { blockedUntil: 1, blockReason: 1 } },
      { new: true }
    );
    if (!user) return res.status(404).json({ error: 'NOT_FOUND' });
    await logAdminAction(req, { action: 'user.unblock', targetType: 'User', targetId: user._id, targetLabel: `${user.name} (${user.email})` });
    res.json({ ok: true });
  })
);

// Permanent delete — SUPER_ADMIN only. A business owner must have their business
// deleted first (DELETE /businesses/:id) so that action's own safety checks apply;
// this route refuses rather than silently orphaning a live business.
router.delete(
  '/users/:id',
  onlySuperAdmin,
  asyncHandler(async (req, res) => {
    if (req.params.id === req.userId) return res.status(400).json({ error: 'CANNOT_REMOVE_SELF' });

    const user = await User.findOne({ _id: req.params.id, role: { $in: ['CLIENT', 'BUSINESS_OWNER'] } });
    if (!user) return res.status(404).json({ error: 'NOT_FOUND' });
    if (user.role === 'BUSINESS_OWNER' && user.business) {
      return res.status(409).json({ error: 'DELETE_BUSINESS_FIRST' });
    }

    await User.deleteOne({ _id: user._id });
    await logAdminAction(req, { action: 'user.delete', targetType: 'User', targetId: user._id, targetLabel: `${user.name} (${user.email})` });
    res.json({ ok: true });
  })
);

router.get(
  '/team',
  onlySuperAdmin,
  asyncHandler(async (_req, res) => {
    const team = await User.find({ role: { $in: ['SUPER_ADMIN', 'MODERATOR', 'FINANCE_ADMIN', 'ADMIN'] } })
      .select('name email role permissions createdAt')
      .sort({ createdAt: 1 })
      .lean();
    res.json({ team });
  })
);

router.post(
  '/team',
  onlySuperAdmin,
  asyncHandler(async (req, res) => {
    const { name, email, password, role, permissions } = req.body || {};
    if (
      typeof name !== 'string' ||
      !name.trim() ||
      !EMAIL_RE.test(email || '') ||
      typeof password !== 'string' ||
      password.length < 8 ||
      !INVITABLE_ROLES.includes(role)
    ) {
      return res.status(400).json({ error: 'INVALID_INPUT' });
    }

    let grantedPermissions;
    if (role === 'ADMIN') {
      if (
        !Array.isArray(permissions) ||
        permissions.length === 0 ||
        !permissions.every((p) => PERMISSION_BUCKETS.includes(p))
      ) {
        return res.status(400).json({ error: 'INVALID_PERMISSIONS' });
      }
      grantedPermissions = [...new Set(permissions)];
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ error: 'EMAIL_TAKEN' });

    const passwordHash = await bcrypt.hash(password, 12);
    const member = await User.create({
      role,
      name: name.trim(),
      email: email.toLowerCase(),
      passwordHash,
      emailVerified: true,
      ...(grantedPermissions ? { permissions: grantedPermissions } : {}),
    });

    await logAdminAction(req, { action: 'team.invite', targetType: 'User', targetId: member._id, targetLabel: `${member.name} (${member.email})`, meta: { role, permissions: grantedPermissions } });

    res.status(201).json({
      member: {
        id: member._id,
        name: member.name,
        email: member.email,
        role: member.role,
        permissions: member.permissions,
        createdAt: member.createdAt,
      },
    });
  })
);

// Self-service — any admin-role user changes their own login. Requires the
// current password, same as the client-facing equivalent, since this is the
// account holder acting on themselves rather than a super-admin resetting
// someone else's.
router.patch(
  '/me/credentials',
  asyncHandler(async (req, res) => {
    const { currentPassword, newEmail, newPassword } = req.body || {};
    if (typeof currentPassword !== 'string' || !currentPassword) {
      return res.status(400).json({ error: 'INVALID_INPUT' });
    }
    if (newEmail === undefined && newPassword === undefined) {
      return res.status(400).json({ error: 'INVALID_INPUT' });
    }
    if (newEmail !== undefined && !EMAIL_RE.test(newEmail || '')) {
      return res.status(400).json({ error: 'INVALID_INPUT' });
    }
    if (newPassword !== undefined && (typeof newPassword !== 'string' || newPassword.length < 8)) {
      return res.status(400).json({ error: 'WEAK_PASSWORD' });
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(401).json({ error: 'UNAUTHENTICATED' });

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });

    if (newEmail !== undefined) {
      const existing = await User.findOne({ email: newEmail.toLowerCase(), _id: { $ne: user._id } });
      if (existing) return res.status(409).json({ error: 'EMAIL_TAKEN' });
      user.email = newEmail.toLowerCase();
    }
    if (newPassword !== undefined) {
      user.passwordHash = await bcrypt.hash(newPassword, 12);
    }
    await user.save();

    await logAdminAction(req, { action: 'team.selfUpdateCredentials', targetType: 'User', targetId: user._id, targetLabel: user.email });

    res.json({ user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  })
);

// Super-admin resetting a team member's login — no current-password check,
// since this is the elevated account acting on someone else's, not the
// member acting on their own (that's /me/credentials above).
router.patch(
  '/team/:id/credentials',
  onlySuperAdmin,
  asyncHandler(async (req, res) => {
    const { newEmail, newPassword } = req.body || {};
    if (newEmail === undefined && newPassword === undefined) {
      return res.status(400).json({ error: 'INVALID_INPUT' });
    }
    if (newEmail !== undefined && !EMAIL_RE.test(newEmail || '')) {
      return res.status(400).json({ error: 'INVALID_INPUT' });
    }
    if (newPassword !== undefined && (typeof newPassword !== 'string' || newPassword.length < 8)) {
      return res.status(400).json({ error: 'WEAK_PASSWORD' });
    }

    const member = await User.findOne({ _id: req.params.id, role: { $in: INVITABLE_ROLES } });
    if (!member) return res.status(404).json({ error: 'NOT_FOUND' });

    if (newEmail !== undefined) {
      const existing = await User.findOne({ email: newEmail.toLowerCase(), _id: { $ne: member._id } });
      if (existing) return res.status(409).json({ error: 'EMAIL_TAKEN' });
      member.email = newEmail.toLowerCase();
    }
    if (newPassword !== undefined) {
      member.passwordHash = await bcrypt.hash(newPassword, 12);
    }
    await member.save();

    await logAdminAction(req, { action: 'team.resetCredentials', targetType: 'User', targetId: member._id, targetLabel: `${member.name} (${member.email})` });

    res.json({ member: { id: member._id, name: member.name, email: member.email, role: member.role } });
  })
);

router.delete(
  '/team/:id',
  onlySuperAdmin,
  asyncHandler(async (req, res) => {
    if (req.params.id === req.userId) return res.status(400).json({ error: 'CANNOT_REMOVE_SELF' });

    const member = await User.findOne({ _id: req.params.id, role: { $in: INVITABLE_ROLES } });
    if (!member) return res.status(404).json({ error: 'NOT_FOUND' });

    await User.deleteOne({ _id: member._id });
    await logAdminAction(req, { action: 'team.remove', targetType: 'User', targetId: member._id, targetLabel: `${member.name} (${member.email})` });
    res.json({ ok: true });
  })
);

// Manual triggers for the nightly/monthly cron jobs — lets an admin run them on demand
// instead of waiting for the schedule (also how we exercise them in local dev).
router.post(
  '/jobs/rating-update',
  onlySuperAdmin,
  asyncHandler(async (_req, res) => {
    await runDailyRatingUpdate();
    res.json({ ok: true });
  })
);

router.post(
  '/jobs/daily-sweep',
  onlySuperAdmin,
  asyncHandler(async (_req, res) => {
    await runDailySweep();
    res.json({ ok: true });
  })
);

router.post(
  '/jobs/monthly-invoices',
  onlySuperAdmin,
  asyncHandler(async (_req, res) => {
    await runMonthlyInvoices();
    res.json({ ok: true });
  })
);

router.post(
  '/jobs/sheets-sync',
  onlySuperAdmin,
  asyncHandler(async (_req, res) => {
    await runSheetsSync();
    res.json({ ok: true });
  })
);

router.get(
  '/audit-log',
  onlySuperAdmin,
  asyncHandler(async (_req, res) => {
    const entries = await AdminAuditLog.find({})
      .populate('admin', 'name email')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    res.json({ entries });
  })
);

// ---- Platform ledger: what the platform earned → owner payout, from A to Z ----
// Mirrors routes/businessCrm.js's ledger design (configurable columns, encrypted
// manual values, recurring vs monthly persistence) but at the platform level: auto
// revenue is real collected cash (paid Invoices + confirmed TOP-placement payments,
// see utils/platformLedgerCalc.js), and the owner records salaries/taxes/other costs
// against it to land on totals.netPayout — the actual bank-account figure.

const PLATFORM_METRIC_GROUPS = ['revenue', 'expense', 'info'];
const PLATFORM_METRIC_UNITS = ['currency', 'number', 'percent', 'text'];
const PLATFORM_METRIC_PERSISTENCE = ['monthly', 'recurring'];
const PLATFORM_MONTH_RE = /^\d{4}-\d{2}$/;
const PLATFORM_REPORT_PERIOD_MONTHS = { month: 1, quarter: 3, 'half-year': 6, '9-months': 9, year: 12 };

function generatePlatformFieldKey() {
  return `pfield-${crypto.randomBytes(4).toString('hex')}`;
}

function currentPlatformMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function addPlatformMonths(monthKey, delta) {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

router.get(
  '/platform-ledger/metric-definitions',
  requirePermission('finance'),
  asyncHandler(async (req, res) => {
    const includeArchived = req.query.includeArchived === '1';
    const filter = {};
    if (!includeArchived) filter.archived = { $ne: true };
    const definitions = await PlatformMetricDefinition.find(filter).sort({ order: 1 }).lean();
    res.json({ definitions });
  })
);

router.post(
  '/platform-ledger/metric-definitions',
  requirePermission('finance'),
  asyncHandler(async (req, res) => {
    const { label, group, unit, persistence } = req.body || {};
    if (typeof label !== 'string' || !label.trim()) return res.status(400).json({ error: 'INVALID_INPUT' });
    if (!PLATFORM_METRIC_GROUPS.includes(group)) return res.status(400).json({ error: 'INVALID_INPUT' });
    if (!PLATFORM_METRIC_UNITS.includes(unit)) return res.status(400).json({ error: 'INVALID_INPUT' });
    if (!PLATFORM_METRIC_PERSISTENCE.includes(persistence)) return res.status(400).json({ error: 'INVALID_INPUT' });

    const key = generatePlatformFieldKey();
    const count = await PlatformMetricDefinition.countDocuments({});

    try {
      const definition = await PlatformMetricDefinition.create({ key, label: label.trim(), group, unit, persistence, order: count });
      await logAdminAction(req, { action: 'platformLedger.createMetric', targetType: 'PlatformMetricDefinition', targetId: definition._id, targetLabel: definition.label });
      res.status(201).json({ definition });
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ error: 'FIELD_EXISTS' });
      throw err;
    }
  })
);

router.patch(
  '/platform-ledger/metric-definitions/:id',
  requirePermission('finance'),
  asyncHandler(async (req, res) => {
    const update = {};
    if (typeof req.body?.label === 'string' && req.body.label.trim()) update.label = req.body.label.trim();
    if (PLATFORM_METRIC_GROUPS.includes(req.body?.group)) update.group = req.body.group;
    if (PLATFORM_METRIC_UNITS.includes(req.body?.unit)) update.unit = req.body.unit;
    if (PLATFORM_METRIC_PERSISTENCE.includes(req.body?.persistence)) update.persistence = req.body.persistence;
    if (typeof req.body?.order === 'number') update.order = req.body.order;

    const definition = await PlatformMetricDefinition.findOneAndUpdate({ _id: req.params.id }, update, { new: true });
    if (!definition) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json({ definition });
  })
);

// Soft-delete only, same reasoning as the business ledger: archiving stops a column
// from appearing in future data entry, but preserves its historical values.
router.delete(
  '/platform-ledger/metric-definitions/:id',
  requirePermission('finance'),
  asyncHandler(async (req, res) => {
    const definition = await PlatformMetricDefinition.findOneAndUpdate({ _id: req.params.id }, { archived: true }, { new: true });
    if (!definition) return res.status(404).json({ error: 'NOT_FOUND' });
    await logAdminAction(req, { action: 'platformLedger.archiveMetric', targetType: 'PlatformMetricDefinition', targetId: definition._id, targetLabel: definition.label });
    res.json({ ok: true });
  })
);

router.get(
  '/platform-ledger/:month',
  requirePermission('finance'),
  asyncHandler(async (req, res) => {
    const month = req.params.month;
    if (!PLATFORM_MONTH_RE.test(month)) return res.status(400).json({ error: 'INVALID_INPUT' });

    const definitions = await PlatformMetricDefinition.find({ archived: { $ne: true } }).sort({ order: 1 }).lean();

    const current = await computePlatformMonthMetrics(month, definitions);
    const previousMonth = addPlatformMonths(month, -1);
    const previous = await computePlatformMonthMetrics(previousMonth, definitions);
    const insights = buildPlatformInsights(current, previous);

    res.json({ ...current, previousMonth: previous.month, insights });
  })
);

router.patch(
  '/platform-ledger/:month',
  requirePermission('finance'),
  asyncHandler(async (req, res) => {
    const month = req.params.month;
    if (!PLATFORM_MONTH_RE.test(month)) return res.status(400).json({ error: 'INVALID_INPUT' });
    if (!req.body?.values || typeof req.body.values !== 'object') return res.status(400).json({ error: 'INVALID_INPUT' });

    const definitions = await PlatformMetricDefinition.find({ archived: { $ne: true } }).select('key').lean();
    const validKeys = new Set(definitions.map((d) => d.key));

    const entry = await MonthlyPlatformLedgerEntry.findOneAndUpdate(
      { month },
      { $setOnInsert: { month } },
      { new: true, upsert: true }
    );

    for (const [key, value] of Object.entries(req.body.values)) {
      if (!validKeys.has(key)) continue;
      entry.values.set(key, encryptValue(value));
    }
    await entry.save();
    await logAdminAction(req, { action: 'platformLedger.updateValues', targetType: 'MonthlyPlatformLedgerEntry', targetLabel: month });

    res.json({ ok: true });
  })
);

router.get(
  '/platform-ledger/reports/:period',
  requirePermission('finance'),
  asyncHandler(async (req, res) => {
    const monthsSpan = PLATFORM_REPORT_PERIOD_MONTHS[req.params.period];
    if (!monthsSpan) return res.status(400).json({ error: 'INVALID_INPUT' });

    const endMonth = typeof req.query.end === 'string' && PLATFORM_MONTH_RE.test(req.query.end) ? req.query.end : currentPlatformMonthKey();
    const definitions = await PlatformMetricDefinition.find({ archived: { $ne: true } }).sort({ order: 1 }).lean();

    const months = Array.from({ length: monthsSpan }, (_, i) => addPlatformMonths(endMonth, -(monthsSpan - 1) + i));
    const monthsMetrics = [];
    for (const month of months) {
      monthsMetrics.push(await computePlatformMonthMetrics(month, definitions));
    }

    const totals = monthsMetrics.reduce(
      (acc, m) => ({
        grossRevenue: acc.grossRevenue + m.totals.grossRevenue,
        totalExpenses: acc.totalExpenses + m.totals.totalExpenses,
        netPayout: acc.netPayout + m.totals.netPayout,
        collectedCommission: acc.collectedCommission + m.auto.collectedCommission,
        collectedTopPlacements: acc.collectedTopPlacements + m.auto.collectedTopPlacements,
        accruedCommission: acc.accruedCommission + m.auto.accruedCommission,
      }),
      { grossRevenue: 0, totalExpenses: 0, netPayout: 0, collectedCommission: 0, collectedTopPlacements: 0, accruedCommission: 0 }
    );
    const marginPercent = totals.grossRevenue > 0 ? Math.round((totals.netPayout / totals.grossRevenue) * 1000) / 10 : 0;

    res.json({
      period: req.params.period,
      endMonth,
      months: monthsMetrics,
      totals: { ...totals, marginPercent },
      insights: buildPlatformPeriodInsights(monthsMetrics),
    });
  })
);

module.exports = router;
