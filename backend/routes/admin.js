const express = require('express');
const bcrypt = require('bcrypt');

const Business = require('../models/Business');
const User = require('../models/User');
const Booking = require('../models/Booking');
const Review = require('../models/Review');
const Service = require('../models/Service');
const Staff = require('../models/Staff');
const Category = require('../models/Category');
const TopPlacement = require('../models/TopPlacement');
const Invoice = require('../models/Invoice');
const PlatformSettings = require('../models/PlatformSettings');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { adminLimiter } = require('../middleware/rateLimit');
const { asyncHandler } = require('../utils/asyncHandler');
const { runDailyRatingUpdate } = require('../jobs/dailyRatingUpdate');
const { runMonthlyInvoices } = require('../jobs/monthlyInvoices');
const { runDailySweep } = require('../jobs/autoUnblock');
const { runSheetsSync } = require('../jobs/sheetsSync');
const { recomputeBusinessReviewStats } = require('../utils/reviewStats');
const { logAdminAction } = require('../utils/auditLog');
const AdminAuditLog = require('../models/AdminAuditLog');

const router = express.Router();

// Any of the three admin roles may enter the /admin API; individual routes
// below narrow further down to the role(s) that should actually act on them.
router.use(requireAuth, requireRole('SUPER_ADMIN', 'MODERATOR', 'FINANCE_ADMIN'), adminLimiter);

const onlySuperAdmin = requireRole('SUPER_ADMIN');
const moderation = requireRole('SUPER_ADMIN', 'MODERATOR');
const finance = requireRole('SUPER_ADMIN', 'FINANCE_ADMIN');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVITABLE_ROLES = ['MODERATOR', 'FINANCE_ADMIN'];

router.get(
  '/overview',
  asyncHandler(async (_req, res) => {
    const [activeBusinesses, pendingBusinesses, clients, completedBookings] = await Promise.all([
      Business.countDocuments({ status: 'ACTIVE' }),
      Business.countDocuments({ status: 'PENDING' }),
      User.countDocuments({ role: 'CLIENT' }),
      Booking.find({ status: 'completed' }).lean(),
    ]);

    const platformRevenue = completedBookings.reduce((sum, b) => sum + b.price * (b.commissionRate ?? 0), 0);

    res.json({
      activeBusinesses,
      pendingBusinesses,
      clients,
      completedBookingsCount: completedBookings.length,
      platformRevenue,
    });
  })
);

router.get(
  '/analytics',
  asyncHandler(async (_req, res) => {
    const todayKey = new Date().toISOString().slice(0, 10);
    const since = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
    const sinceKey = since.toISOString().slice(0, 10);

    const currentMonth = todayKey.slice(0, 7);

    const [newBusinesses, newClients, completedBookings, categoryAgg, outstandingAgg, paidThisMonthAgg, overdueCount, topBusinessesAgg] = await Promise.all([
      Business.find({ createdAt: { $gte: since } }).select('createdAt').lean(),
      User.find({ role: 'CLIENT', createdAt: { $gte: since } }).select('createdAt').lean(),
      Booking.find({ status: 'completed', date: { $gte: sinceKey, $lte: todayKey } })
        .select('date price commissionRate')
        .lean(),
      Business.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]),
      Invoice.aggregate([
        { $match: { status: { $in: ['PENDING', 'AWAITING_VERIFICATION', 'OVERDUE'] } } },
        { $group: { _id: null, total: { $sum: '$totalCommission' } } },
      ]),
      Invoice.aggregate([
        { $match: { status: 'PAID', month: currentMonth } },
        { $group: { _id: null, total: { $sum: '$totalCommission' } } },
      ]),
      Invoice.countDocuments({ status: 'OVERDUE' }),
      Booking.aggregate([
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
      ]),
    ]);

    const byDay = new Map();
    for (let i = 0; i < 30; i++) {
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
        bucket.completedBookings += 1;
        bucket.revenue += b.price * (b.commissionRate ?? 0);
      }
    }

    const categoryBreakdown = categoryAgg.map((c) => ({ category: c._id, count: c.count }));
    const topBusinesses = topBusinessesAgg.map((b) => ({ name: b.name, bookings: b.bookings, revenue: b.revenue }));

    const totalGMV = completedBookings.reduce((sum, b) => sum + b.price, 0);
    const totalPlatformRevenue = completedBookings.reduce((sum, b) => sum + b.price * (b.commissionRate ?? 0), 0);

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
  moderation,
  asyncHandler(async (req, res) => {
    const { status } = req.query;
    const filter = {};
    if (typeof status === 'string' && status) filter.status = status;

    const businesses = await Business.find(filter)
      .populate('owner', 'name email')
      .populate('city', 'name')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ businesses });
  })
);

router.get(
  '/businesses/:id',
  moderation,
  asyncHandler(async (req, res) => {
    const business = await Business.findById(req.params.id)
      .populate('owner', 'name email phone')
      .populate('city', 'name')
      .lean();
    if (!business) return res.status(404).json({ error: 'NOT_FOUND' });

    const [servicesCount, staffCount, completedBookings, revenueAgg] = await Promise.all([
      Service.countDocuments({ business: business._id, active: true }),
      Staff.countDocuments({ business: business._id, active: true }),
      Booking.countDocuments({ business: business._id, status: 'completed' }),
      Booking.aggregate([
        { $match: { business: business._id, status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$price' } } },
      ]),
    ]);

    res.json({
      business,
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
  moderation,
  asyncHandler(async (req, res) => {
    const business = await Business.findByIdAndUpdate(
      req.params.id,
      { status: 'ACTIVE', rejectionReason: undefined },
      { new: true }
    );
    if (!business) return res.status(404).json({ error: 'NOT_FOUND' });
    await logAdminAction(req, { action: 'business.approve', targetType: 'Business', targetId: business._id, targetLabel: business.name });
    res.json({ business });
  })
);

router.post(
  '/businesses/:id/reject',
  moderation,
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
  moderation,
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
  moderation,
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
  moderation,
  asyncHandler(async (req, res) => {
    const { status, flaggedReplies } = req.query;
    const filter = {};
    if (flaggedReplies === 'true') {
      filter.replyFlagged = true;
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
  moderation,
  asyncHandler(async (req, res) => {
    const review = await Review.findByIdAndUpdate(req.params.id, { status: 'PUBLISHED' }, { new: true });
    if (!review) return res.status(404).json({ error: 'NOT_FOUND' });
    await recomputeBusinessReviewStats(review.business);
    res.json({ review });
  })
);

router.post(
  '/reviews/:id/reject',
  moderation,
  asyncHandler(async (req, res) => {
    const review = await Review.findByIdAndUpdate(req.params.id, { status: 'REJECTED' }, { new: true });
    if (!review) return res.status(404).json({ error: 'NOT_FOUND' });
    await recomputeBusinessReviewStats(review.business);
    res.json({ review });
  })
);

router.post(
  '/reviews/:id/clear-reply-flag',
  moderation,
  asyncHandler(async (req, res) => {
    const review = await Review.findByIdAndUpdate(req.params.id, { replyFlagged: false }, { new: true });
    if (!review) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json({ review });
  })
);

router.post(
  '/reviews/:id/remove-reply',
  moderation,
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
  moderation,
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
  moderation,
  asyncHandler(async (req, res) => {
    // Admin can fast-track activation once the business has confirmed payment
    // (AWAITING_ACTIVATION), instead of waiting for the 15-minute auto-activation timer.
    const placement = await TopPlacement.findOne({ _id: req.params.id, status: 'AWAITING_ACTIVATION' });
    if (!placement) return res.status(404).json({ error: 'NOT_FOUND' });

    const confirmedAt = new Date();
    const expiresAt = new Date(confirmedAt.getTime() + placement.durationDays * 24 * 60 * 60 * 1000);

    placement.status = 'CONFIRMED';
    placement.confirmedAt = confirmedAt;
    placement.expiresAt = expiresAt;
    await placement.save();

    await Business.updateOne({ _id: placement.business }, { top: { active: true, until: expiresAt } });
    await logAdminAction(req, { action: 'topPlacement.confirm', targetType: 'TopPlacement', targetId: placement._id, meta: { business: placement.business } });

    res.json({ placement });
  })
);

router.post(
  '/top-placements/:id/reject',
  moderation,
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
  finance,
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
  finance,
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
  finance,
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
    // Mirrors the role boundaries on the underlying list endpoints below
    // (moderation for businesses/top-placements, finance for invoices) — a
    // FINANCE_ADMIN can't list pending businesses and shouldn't learn even the
    // count of them, and likewise a MODERATOR shouldn't learn the invoice count.
    const canModerate = req.userRole === 'SUPER_ADMIN' || req.userRole === 'MODERATOR';
    const canFinance = req.userRole === 'SUPER_ADMIN' || req.userRole === 'FINANCE_ADMIN';

    const [pendingBusinesses, pendingTopPlacements, pendingInvoices] = await Promise.all([
      canModerate ? Business.countDocuments({ status: 'PENDING' }) : Promise.resolve(0),
      canModerate ? TopPlacement.countDocuments({ status: 'AWAITING_ACTIVATION' }) : Promise.resolve(0),
      canFinance ? Invoice.countDocuments({ status: 'AWAITING_VERIFICATION' }) : Promise.resolve(0),
    ]);
    res.json({ pendingBusinesses, pendingTopPlacements, pendingInvoices });
  })
);

router.get(
  '/invoices',
  finance,
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

router.post(
  '/invoices/:id/mark-paid',
  finance,
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
  finance,
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
  moderation,
  asyncHandler(async (req, res) => {
    const { status } = req.query;
    const filter = {};
    if (typeof status === 'string' && status) filter.status = status;
    else filter.status = 'PENDING';

    const categories = await Category.find(filter)
      .populate('requestedByBusiness', 'name')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ categories });
  })
);

router.post(
  '/categories/:id/approve',
  moderation,
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
  moderation,
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

router.get(
  '/users',
  moderation,
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
  moderation,
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
  moderation,
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
    const team = await User.find({ role: { $in: ['SUPER_ADMIN', 'MODERATOR', 'FINANCE_ADMIN'] } })
      .select('name email role createdAt')
      .sort({ createdAt: 1 })
      .lean();
    res.json({ team });
  })
);

router.post(
  '/team',
  onlySuperAdmin,
  asyncHandler(async (req, res) => {
    const { name, email, password, role } = req.body || {};
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

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ error: 'EMAIL_TAKEN' });

    const passwordHash = await bcrypt.hash(password, 12);
    const member = await User.create({
      role,
      name: name.trim(),
      email: email.toLowerCase(),
      passwordHash,
      emailVerified: true,
    });

    await logAdminAction(req, { action: 'team.invite', targetType: 'User', targetId: member._id, targetLabel: `${member.name} (${member.email})`, meta: { role } });

    res.status(201).json({
      member: { id: member._id, name: member.name, email: member.email, role: member.role, createdAt: member.createdAt },
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

module.exports = router;
