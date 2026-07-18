const express = require('express');
const mongoose = require('mongoose');

const Booking = require('../models/Booking');
const Service = require('../models/Service');
const Staff = require('../models/Staff');
const Notification = require('../models/Notification');
const Review = require('../models/Review');
const TopPlacement = require('../models/TopPlacement');
const Invoice = require('../models/Invoice');
const { PACKAGES } = TopPlacement;
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { attachBusiness } = require('../middleware/business');
const { asyncHandler } = require('../utils/asyncHandler');
const { slotUnavailableReason, reasonToErrorCode, maxWorkingDayMinutes } = require('../utils/availability');
const { createManualBooking } = require('../utils/manualBooking');
const { getWeekRange } = require('../utils/weekRange');
const { applyClientViolation } = require('../utils/clientPenalty');
const { containsStopWords } = require('../utils/stopWords');
const { applyPhoneReveal } = require('../utils/phoneReveal');
const Business = require('../models/Business');
const Category = require('../models/Category');
const PlatformSettings = require('../models/PlatformSettings');
const { customCategorySlug } = require('../utils/slugify');
const { imageUploader, pdfUploader, finalizeUpload, verifyImageSignature, verifyPdfSignature } = require('../middleware/upload');

const staffPhotoUpload = imageUploader('staff');
const businessPhotoUpload = imageUploader('business');
const receiptUpload = pdfUploader('receipts');

const router = express.Router();
router.use(requireAuth, requireRole('BUSINESS_OWNER'), attachBusiness);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function bookingDateTime(booking) {
  return new Date(`${booking.date}T${booking.startTime}:00`);
}

router.get(
  '/me',
  asyncHandler(async (req, res) => {
    res.json({ business: req.businessDoc });
  })
);

router.get(
  '/payment-requisites',
  asyncHandler(async (req, res) => {
    const settings = await PlatformSettings.getOrCreate();
    res.json({
      commissionRequisites: settings.commissionRequisites,
      topPlacementRequisites: settings.topPlacementRequisites,
    });
  })
);

const EDITABLE_BUSINESS_FIELDS = ['description', 'address', 'district', 'phone', 'googleMapsUrl'];
const WEEKDAY_KEYS = new Set(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);

router.patch(
  '/me',
  asyncHandler(async (req, res) => {
    const update = {};
    for (const field of EDITABLE_BUSINESS_FIELDS) {
      if (typeof req.body?.[field] === 'string') update[field] = req.body[field].trim();
    }
    if (req.body?.socials && typeof req.body.socials === 'object') {
      update.socials = {
        instagram: typeof req.body.socials.instagram === 'string' ? req.body.socials.instagram.trim() : req.businessDoc.socials?.instagram,
        facebook: typeof req.body.socials.facebook === 'string' ? req.body.socials.facebook.trim() : req.businessDoc.socials?.facebook,
      };
    }

    const business = await Business.findByIdAndUpdate(req.businessId, update, { new: true });
    res.json({ business });
  })
);

router.patch(
  '/me/working-hours',
  asyncHandler(async (req, res) => {
    if (!req.body?.workingHours || typeof req.body.workingHours !== 'object') {
      return res.status(400).json({ error: 'INVALID_INPUT' });
    }
    // Built from only the recognized weekday keys, ignoring anything else on the body —
    // notably a stray _id, which a client that round-trips a previous GET response could
    // otherwise echo straight back (Mongoose subdocuments carry their own _id).
    const workingHours = {};
    for (const [key, value] of Object.entries(req.body.workingHours)) {
      if (!WEEKDAY_KEYS.has(key)) continue;
      workingHours[key] = value;
    }

    const business = await Business.findByIdAndUpdate(
      req.businessId,
      { workingHours },
      { new: true }
    );
    res.json({ business });
  })
);

router.post(
  '/me/cover-photo',
  businessPhotoUpload.single('photo'),
  verifyImageSignature,
  finalizeUpload('business'),
  asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'INVALID_FILE' });
    const business = await Business.findByIdAndUpdate(
      req.businessId,
      { coverPhotoUrl: req.file.publicUrl },
      { new: true }
    );
    res.json({ business });
  })
);

router.post(
  '/me/gallery',
  businessPhotoUpload.array('photos', 12),
  verifyImageSignature,
  finalizeUpload('business'),
  asyncHandler(async (req, res) => {
    if (!req.files?.length) return res.status(400).json({ error: 'INVALID_FILE' });
    const urls = req.files.map((f) => f.publicUrl);
    const business = await Business.findByIdAndUpdate(
      req.businessId,
      { $push: { galleryUrls: { $each: urls } } },
      { new: true }
    );
    res.json({ business });
  })
);

router.delete(
  '/me/gallery',
  asyncHandler(async (req, res) => {
    const { url } = req.body || {};
    if (typeof url !== 'string') return res.status(400).json({ error: 'INVALID_INPUT' });
    const business = await Business.findByIdAndUpdate(
      req.businessId,
      { $pull: { galleryUrls: url } },
      { new: true }
    );
    res.json({ business });
  })
);

router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const today = todayStr();
    const { from: weekFrom, to: weekTo } = getWeekRange(today);
    const monthStart = `${today.slice(0, 7)}-01`;

    const [todayBookings, weekBookings, monthBookings] = await Promise.all([
      Booking.find({ business: req.businessId, date: today, status: { $in: ['confirmed', 'completed'] } }).lean(),
      Booking.find({
        business: req.businessId,
        date: { $gte: weekFrom, $lte: weekTo },
        status: { $in: ['confirmed', 'completed'] },
      }).lean(),
      Booking.find({
        business: req.businessId,
        date: { $gte: monthStart, $lte: today },
        status: 'completed',
      }).lean(),
    ]);

    const revenueToday = todayBookings.reduce((sum, b) => sum + b.price, 0);
    const revenueMonth = monthBookings.reduce((sum, b) => sum + b.price, 0);

    res.json({
      bookingsToday: todayBookings.length,
      bookingsWeek: weekBookings.length,
      revenueToday,
      revenueMonth,
      rating: req.businessDoc.googleRating * 0.6 + (req.businessDoc.platformRating || req.businessDoc.googleRating) * 0.4,
      top: req.businessDoc.top,
    });
  })
);

router.get(
  '/analytics',
  asyncHandler(async (req, res) => {
    const allowedRanges = [7, 30, 90];
    const requestedDays = Number(req.query.days);
    const rangeDays = allowedRanges.includes(requestedDays) ? requestedDays : 30;
    const staffFilter = typeof req.query.staffId === 'string' && req.query.staffId ? req.query.staffId : null;

    const todayKey = new Date().toISOString().slice(0, 10);
    const since = new Date(Date.now() - (rangeDays - 1) * 24 * 60 * 60 * 1000);
    const sinceKey = since.toISOString().slice(0, 10);

    const allStaff = await Staff.find({ business: req.businessId, active: true }).select('name photoUrl').lean();

    const rangeBookings = await Booking.find({
      business: req.businessId,
      date: { $gte: sinceKey, $lte: todayKey },
      status: { $in: ['confirmed', 'completed'] },
    })
      .populate('service', 'name')
      .lean();

    // Per-master breakdown always covers every master in the selected range,
    // independent of the staffId filter below (which only narrows the charts).
    const byStaff = new Map(allStaff.map((s) => [String(s._id), { staffId: String(s._id), name: s.name, photoUrl: s.photoUrl, bookings: 0, revenue: 0 }]));
    for (const b of rangeBookings) {
      const entry = byStaff.get(String(b.staff));
      if (entry) {
        entry.bookings += 1;
        if (b.status === 'completed') entry.revenue += b.price;
      }
    }
    const staffBreakdown = [...byStaff.values()].sort((a, b) => b.revenue - a.revenue);

    const bookings = staffFilter ? rangeBookings.filter((b) => String(b.staff) === staffFilter) : rangeBookings;

    const byDay = new Map();
    for (let i = 0; i < rangeDays; i++) {
      const key = new Date(since.getTime() + i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      byDay.set(key, { date: key, bookings: 0, revenue: 0 });
    }

    const bySource = { platform: 0, manual: 0 };
    const byService = new Map();

    for (const b of bookings) {
      const bucket = byDay.get(b.date);
      if (bucket) {
        bucket.bookings += 1;
        if (b.status === 'completed') bucket.revenue += b.price;
      }
      bySource[b.source] = (bySource[b.source] || 0) + 1;

      const serviceId = String(b.service?._id ?? b.service);
      const serviceName = b.service?.name ?? '—';
      const entry = byService.get(serviceId) ?? { serviceId, name: serviceName, bookings: 0, revenue: 0 };
      entry.bookings += 1;
      if (b.status === 'completed') entry.revenue += b.price;
      byService.set(serviceId, entry);
    }

    const topServices = [...byService.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    let totalRevenue = 0;
    let completedCount = 0;
    let totalCommission = 0;
    for (const b of bookings) {
      if (b.status === 'completed') {
        totalRevenue += b.price;
        completedCount += 1;
        totalCommission += b.price * (b.commissionRate ?? 0);
      }
    }
    const averageCheck = completedCount > 0 ? Math.round(totalRevenue / completedCount) : 0;
    const netEarnings = Math.round(totalRevenue - totalCommission);

    // Previous period of equal length, immediately before the current window, scoped
    // to the same staffId filter — gives the "vs last period" trend businesses actually
    // want to see rather than just a flat total.
    const prevSince = new Date(since.getTime() - rangeDays * 24 * 60 * 60 * 1000);
    const prevUntil = new Date(since.getTime() - 24 * 60 * 60 * 1000);
    const prevQuery = {
      business: req.businessId,
      date: { $gte: prevSince.toISOString().slice(0, 10), $lte: prevUntil.toISOString().slice(0, 10) },
      status: 'completed',
    };
    if (staffFilter) prevQuery.staff = staffFilter;
    const prevBookings = await Booking.find(prevQuery).select('price').lean();
    const previousRevenue = prevBookings.reduce((sum, b) => sum + b.price, 0);
    const revenueChangePercent =
      previousRevenue > 0
        ? Math.round(((totalRevenue - previousRevenue) / previousRevenue) * 100)
        : totalRevenue > 0
          ? 100
          : 0;

    // MVP is always "this calendar week", independent of the days-range tab or
    // staffId filter above — it's a fixed weekly leaderboard fact, not a view setting.
    let mvpStaffId = null;
    if (allStaff.length >= 2) {
      const { from: weekFrom, to: weekTo } = getWeekRange(todayKey);
      const weekBookings = await Booking.find({
        business: req.businessId,
        date: { $gte: weekFrom, $lte: weekTo },
        status: 'completed',
      })
        .select('staff price')
        .lean();
      const weekRevenueByStaff = new Map();
      for (const b of weekBookings) {
        const key = String(b.staff);
        weekRevenueByStaff.set(key, (weekRevenueByStaff.get(key) ?? 0) + b.price);
      }
      let topRevenue = 0;
      for (const [staffId, revenue] of weekRevenueByStaff) {
        if (revenue > topRevenue) {
          topRevenue = revenue;
          mvpStaffId = staffId;
        }
      }
    }

    res.json({
      daily: [...byDay.values()],
      sourceSplit: bySource,
      topServices,
      staffBreakdown,
      mvpStaffId,
      summary: {
        totalRevenue,
        completedBookings: completedCount,
        averageCheck,
        totalCommission: Math.round(totalCommission),
        netEarnings,
        previousRevenue,
        revenueChangePercent,
      },
    });
  })
);

router.get(
  '/bookings',
  asyncHandler(async (req, res) => {
    const { date } = req.query;
    const target = DATE_RE.test(date || '') ? date : todayStr();
    const { from, to } = getWeekRange(target);

    const bookings = await Booking.find({ business: req.businessId, date: { $gte: from, $lte: to } })
      .populate('service', 'name price')
      .populate('staff', 'name')
      .sort({ date: 1, startTime: 1 })
      .lean();

    res.json({ from, to, bookings: bookings.map(applyPhoneReveal) });
  })
);

router.post(
  '/bookings',
  asyncHandler(async (req, res) => {
    const { serviceId, staffId, date, startTime, clientName, clientPhone, comment } = req.body || {};

    if (
      typeof serviceId !== 'string' ||
      typeof staffId !== 'string' ||
      typeof date !== 'string' ||
      typeof startTime !== 'string' ||
      !DATE_RE.test(date) ||
      !TIME_RE.test(startTime) ||
      typeof clientName !== 'string' ||
      !clientName.trim()
    ) {
      return res.status(400).json({ error: 'INVALID_INPUT' });
    }

    const [service, staff] = await Promise.all([
      Service.findOne({ _id: serviceId, business: req.businessId, active: true }),
      Staff.findOne({ _id: staffId, business: req.businessId, active: true }),
    ]);
    if (!service || !staff) return res.status(404).json({ error: 'NOT_FOUND' });

    try {
      const booking = await createManualBooking({
        businessId: req.businessId,
        businessCreatedAt: req.businessDoc.createdAt,
        service,
        staff,
        date,
        startTime,
        clientName,
        clientPhone,
        comment,
      });
      res.status(201).json({ booking: applyPhoneReveal(booking.toObject()) });
    } catch (err) {
      if (err.code === 'OUTSIDE_WORKING_HOURS') return res.status(409).json({ error: 'OUTSIDE_WORKING_HOURS' });
      if (err.code === 'ON_BREAK') return res.status(409).json({ error: 'ON_BREAK' });
      if (err.code === 'SLOT_TAKEN' || err.code === 11000) return res.status(409).json({ error: 'SLOT_TAKEN' });
      throw err;
    }
  })
);

async function setBookingStatus(req, res, status, extra = {}) {
  const booking = await Booking.findOne({ _id: req.params.id, business: req.businessId }).populate('service', 'name');
  if (!booking) return res.status(404).json({ error: 'NOT_FOUND' });

  // A booking can only transition out of 'confirmed' once — without this guard a business
  // could replay POST .../no-show on an already-settled booking and repeatedly dock the
  // client's rating (or flip a completed visit back to no-show) via the same request.
  if (booking.status !== 'confirmed') {
    return res.status(400).json({ error: 'INVALID_STATE_TRANSITION' });
  }
  if (status === 'no_show' && bookingDateTime(booking) > new Date()) {
    return res.status(400).json({ error: 'BOOKING_NOT_YET_DUE' });
  }

  booking.status = status;
  Object.assign(booking, extra);

  if (status === 'cancelled_by_business') {
    booking.cancellationConfirmation = { askedAt: new Date(), processed: false };
  }

  await booking.save();

  if (status === 'cancelled_by_business' && booking.client) {
    await Notification.create({
      user: booking.client,
      type: 'booking_cancelled_by_business',
      title: 'Бізнес скасував ваш запис',
      text: `${req.businessDoc.name} скасував запис на ${booking.date} о ${booking.startTime}. Це сталось на ваше прохання?`,
      relatedBooking: booking._id,
    });
  }

  if (status === 'no_show' && booking.client) {
    await applyClientViolation(booking.client, 'no_show');
  }

  res.json({ booking: applyPhoneReveal(booking.toObject()) });
}

router.post(
  '/bookings/:id/cancel',
  asyncHandler((req, res) => setBookingStatus(req, res, 'cancelled_by_business'))
);

router.post(
  '/bookings/:id/complete',
  asyncHandler((req, res) => setBookingStatus(req, res, 'completed'))
);

router.post(
  '/bookings/:id/no-show',
  asyncHandler((req, res) => setBookingStatus(req, res, 'no_show', { commissionCharged: false }))
);

router.post(
  '/bookings/:id/ready',
  asyncHandler(async (req, res) => {
    const booking = await Booking.findOne({ _id: req.params.id, business: req.businessId });
    if (!booking) return res.status(404).json({ error: 'NOT_FOUND' });
    if (booking.status !== 'confirmed') return res.status(400).json({ error: 'NOT_READYABLE' });
    if (booking.readyAt) return res.status(400).json({ error: 'ALREADY_READY' });

    booking.readyAt = new Date();
    await booking.save();

    if (booking.client) {
      await Notification.create({
        user: booking.client,
        type: 'order_ready',
        title: 'Ми готові вас прийняти!',
        text: `${req.businessDoc.name} чекає на вас на ${booking.startTime}. Підходьте, коли будете готові.`,
        relatedBooking: booking._id,
      });
    }

    res.json({ booking: applyPhoneReveal(booking.toObject()) });
  })
);

// Lets a business correct how long a specific appointment actually took (distinct
// from a service's default duration, which only affects future bookings) — e.g. a
// dental procedure that ran longer than scheduled. Re-checks for overlap with the
// same staff's next booking so an edit can't silently create a double-booking.
router.patch(
  '/bookings/:id/duration',
  asyncHandler(async (req, res) => {
    const { durationMinutes } = req.body || {};
    if (typeof durationMinutes !== 'number' || durationMinutes <= 0) {
      return res.status(400).json({ error: 'INVALID_INPUT' });
    }

    const booking = await Booking.findOne({ _id: req.params.id, business: req.businessId });
    if (!booking) return res.status(404).json({ error: 'NOT_FOUND' });

    const staff = await Staff.findById(booking.staff);
    if (!staff) return res.status(404).json({ error: 'NOT_FOUND' });

    const reason = await slotUnavailableReason({
      staff,
      date: booking.date,
      startTime: booking.startTime,
      durationMinutes,
      excludeBookingId: booking._id,
    });
    if (reason) return res.status(409).json({ error: reasonToErrorCode(reason) });

    booking.durationMinutes = durationMinutes;
    await booking.save();
    res.json({ booking: applyPhoneReveal(booking.toObject()) });
  })
);

router.post(
  '/bookings/:id/reschedule',
  asyncHandler(async (req, res) => {
    const { date, startTime, staffId } = req.body || {};
    if (
      typeof date !== 'string' ||
      typeof startTime !== 'string' ||
      !DATE_RE.test(date) ||
      !TIME_RE.test(startTime)
    ) {
      return res.status(400).json({ error: 'INVALID_INPUT' });
    }

    const booking = await Booking.findOne({ _id: req.params.id, business: req.businessId });
    if (!booking) return res.status(404).json({ error: 'NOT_FOUND' });
    if (booking.status !== 'confirmed') return res.status(400).json({ error: 'NOT_RESCHEDULABLE' });

    const staff = await Staff.findOne({
      _id: staffId || booking.staff,
      business: req.businessId,
      active: true,
    });
    if (!staff) return res.status(404).json({ error: 'NOT_FOUND' });

    const hoursUntil = (new Date(`${booking.date}T${booking.startTime}:00`).getTime() - Date.now()) / (1000 * 60 * 60);
    const policyHours = req.businessDoc.cancellationPolicyHours;
    const isLate = hoursUntil < policyHours;

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const reason = await slotUnavailableReason({
          staff,
          date,
          startTime,
          durationMinutes: booking.durationMinutes,
          session,
          excludeBookingId: booking._id,
        });
        if (reason) {
          const code = reasonToErrorCode(reason);
          const err = new Error(code);
          err.code = code;
          throw err;
        }

        booking.date = date;
        booking.startTime = startTime;
        booking.staff = staff._id;
        await booking.save({ session });
      });
    } catch (err) {
      if (err.code === 'OUTSIDE_WORKING_HOURS' || err.code === 'ON_BREAK') return res.status(409).json({ error: err.code });
      if (err.code === 'SLOT_TAKEN' || err.code === 11000) return res.status(409).json({ error: 'SLOT_TAKEN' });
      throw err;
    } finally {
      await session.endSession();
    }

    res.json({ booking: applyPhoneReveal(booking.toObject()), isLate, policyHours });
  })
);

router.get(
  '/reviews',
  asyncHandler(async (req, res) => {
    const reviews = await Review.find({ business: req.businessId, status: 'PUBLISHED' })
      .populate('client', 'name')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ reviews });
  })
);

router.post(
  '/reviews/:id/reply',
  asyncHandler(async (req, res) => {
    const { text } = req.body || {};
    if (typeof text !== 'string' || !text.trim()) return res.status(400).json({ error: 'INVALID_INPUT' });

    const review = await Review.findOne({ _id: req.params.id, business: req.businessId, status: 'PUBLISHED' });
    if (!review) return res.status(404).json({ error: 'NOT_FOUND' });

    review.reply = { text: text.trim(), repliedAt: new Date() };
    review.replyFlagged = containsStopWords(text);
    await review.save();

    res.json({ review });
  })
);

router.get(
  '/top-placement',
  asyncHandler(async (req, res) => {
    const [pending, history] = await Promise.all([
      TopPlacement.findOne({ business: req.businessId, status: { $in: ['PENDING', 'AWAITING_ACTIVATION'] } }).lean(),
      TopPlacement.find({ business: req.businessId }).sort({ createdAt: -1 }).limit(10).lean(),
    ]);
    res.json({ top: req.businessDoc.top, packages: PACKAGES, pending, history });
  })
);

router.post(
  '/top-placement',
  asyncHandler(async (req, res) => {
    const { package: pkg } = req.body || {};
    if (!Object.prototype.hasOwnProperty.call(PACKAGES, pkg || '')) {
      return res.status(400).json({ error: 'INVALID_PACKAGE' });
    }

    const existingPending = await TopPlacement.findOne({
      business: req.businessId,
      status: { $in: ['PENDING', 'AWAITING_ACTIVATION'] },
    });
    if (existingPending) return res.status(409).json({ error: 'REQUEST_PENDING' });

    const { days, price } = PACKAGES[pkg];
    const placement = await TopPlacement.create({
      business: req.businessId,
      package: pkg,
      amount: price,
      durationDays: days,
    });

    res.status(201).json({ placement });
  })
);

router.post(
  '/top-placement/:id/confirm-payment',
  receiptUpload.single('receipt'),
  verifyPdfSignature,
  finalizeUpload('receipts', 'pdf'),
  asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'INVALID_FILE' });

    const placement = await TopPlacement.findOne({
      _id: req.params.id,
      business: req.businessId,
      status: 'PENDING',
    });
    if (!placement) return res.status(404).json({ error: 'NOT_FOUND' });

    placement.status = 'AWAITING_ACTIVATION';
    placement.receiptUrl = req.file.publicUrl;
    placement.paymentConfirmedAt = new Date();
    placement.activateAt = new Date(Date.now() + 15 * 60 * 1000);
    await placement.save();

    res.json({ placement });
  })
);

router.get(
  '/invoices',
  asyncHandler(async (req, res) => {
    const invoices = await Invoice.find({ business: req.businessId }).sort({ issuedAt: -1 }).lean();
    res.json({ invoices, billing: req.businessDoc.billing });
  })
);

router.post(
  '/invoices/:id/confirm-payment',
  receiptUpload.single('receipt'),
  verifyPdfSignature,
  finalizeUpload('receipts', 'pdf'),
  asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'INVALID_FILE' });

    const invoice = await Invoice.findOne({
      _id: req.params.id,
      business: req.businessId,
      status: { $in: ['PENDING', 'OVERDUE', 'BLOCKED'] },
    });
    if (!invoice) return res.status(404).json({ error: 'NOT_FOUND' });

    const receiptUrl = req.file.publicUrl;
    invoice.status = 'AWAITING_VERIFICATION';
    invoice.receiptUrl = receiptUrl;
    invoice.paymentConfirmedAt = new Date();
    invoice.receiptRejectedReason = undefined;
    invoice.receiptHistory.push({ receiptUrl, submittedAt: invoice.paymentConfirmedAt, status: 'PENDING_REVIEW' });
    await invoice.save();

    res.json({ invoice });
  })
);

router.get(
  '/services',
  asyncHandler(async (req, res) => {
    const services = await Service.find({ business: req.businessId, active: true }).sort({ createdAt: 1 }).lean();
    res.json({ services });
  })
);

router.post(
  '/services',
  asyncHandler(async (req, res) => {
    const { name, description, price, durationMinutes, category, customCategoryName, staff } = req.body || {};
    if (
      typeof name !== 'string' ||
      !name.trim() ||
      typeof category !== 'string' ||
      !category.trim() ||
      typeof price !== 'number' ||
      price <= 0 ||
      typeof durationMinutes !== 'number' ||
      durationMinutes <= 0
    ) {
      return res.status(400).json({ error: 'INVALID_INPUT' });
    }

    const maxDuration = maxWorkingDayMinutes(req.businessDoc.workingHours);
    if (maxDuration > 0 && durationMinutes > maxDuration) {
      return res.status(400).json({ error: 'SERVICE_TOO_LONG', maxDurationMinutes: maxDuration });
    }

    let categorySlug = category;
    if (category === 'other') {
      if (typeof customCategoryName !== 'string' || !customCategoryName.trim()) {
        return res.status(400).json({ error: 'INVALID_INPUT' });
      }
      const pendingCategory = await Category.create({
        slug: customCategorySlug(),
        name: customCategoryName.trim(),
        nameEn: customCategoryName.trim(),
        status: 'PENDING',
        requestedByBusiness: req.businessId,
      });
      categorySlug = pendingCategory.slug;
    } else {
      const existingCategory = await Category.findOne({ slug: category, status: 'ACTIVE' });
      if (!existingCategory) return res.status(400).json({ error: 'INVALID_CATEGORY' });
    }

    let staffIds;
    if (Array.isArray(staff) && staff.length) {
      const validStaff = await Staff.find({ _id: { $in: staff }, business: req.businessId }).select('_id').lean();
      staffIds = validStaff.map((s) => s._id);
    }

    const service = await Service.create({
      business: req.businessId,
      name: name.trim(),
      description,
      price,
      durationMinutes,
      category: categorySlug,
      staff: staffIds,
    });
    res.status(201).json({ service });
  })
);

router.patch(
  '/services/:id',
  asyncHandler(async (req, res) => {
    const allowed = ['name', 'description', 'price', 'durationMinutes', 'category', 'staff'];
    const update = {};
    for (const key of allowed) if (key in (req.body || {})) update[key] = req.body[key];

    if ('durationMinutes' in update) {
      if (typeof update.durationMinutes !== 'number' || update.durationMinutes <= 0) {
        return res.status(400).json({ error: 'INVALID_INPUT' });
      }
      const maxDuration = maxWorkingDayMinutes(req.businessDoc.workingHours);
      if (maxDuration > 0 && update.durationMinutes > maxDuration) {
        return res.status(400).json({ error: 'SERVICE_TOO_LONG', maxDurationMinutes: maxDuration });
      }
    }

    if (Array.isArray(update.staff)) {
      if (update.staff.length) {
        const validStaff = await Staff.find({ _id: { $in: update.staff }, business: req.businessId })
          .select('_id')
          .lean();
        update.staff = validStaff.map((s) => s._id);
      } else {
        update.staff = [];
      }
    }

    const service = await Service.findOneAndUpdate(
      { _id: req.params.id, business: req.businessId },
      update,
      { new: true }
    );
    if (!service) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json({ service });
  })
);

router.delete(
  '/services/:id',
  asyncHandler(async (req, res) => {
    const service = await Service.findOneAndUpdate(
      { _id: req.params.id, business: req.businessId },
      { active: false },
      { new: true }
    );
    if (!service) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json({ ok: true });
  })
);

router.get(
  '/staff',
  asyncHandler(async (req, res) => {
    const staff = await Staff.find({ business: req.businessId, active: true }).sort({ createdAt: 1 }).lean();
    res.json({ staff });
  })
);

router.post(
  '/staff',
  asyncHandler(async (req, res) => {
    const { name, role, bio } = req.body || {};
    if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'INVALID_INPUT' });

    const staff = await Staff.create({ business: req.businessId, name: name.trim(), role, bio });
    res.status(201).json({ staff });
  })
);

router.patch(
  '/staff/:id',
  asyncHandler(async (req, res) => {
    const update = {};
    if (typeof req.body?.name === 'string' && req.body.name.trim()) update.name = req.body.name.trim();
    if (typeof req.body?.role === 'string') update.role = req.body.role;
    if (typeof req.body?.bio === 'string') update.bio = req.body.bio;

    if (req.body?.schedule && typeof req.body.schedule === 'object') {
      for (const key of Object.keys(req.body.schedule)) {
        if (!WEEKDAY_KEYS.has(key)) return res.status(400).json({ error: 'INVALID_SCHEDULE' });
      }
      update.schedule = req.body.schedule;
    }

    const staff = await Staff.findOneAndUpdate({ _id: req.params.id, business: req.businessId }, update, {
      new: true,
    });
    if (!staff) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json({ staff });
  })
);

router.delete(
  '/staff/:id',
  asyncHandler(async (req, res) => {
    const staff = await Staff.findOneAndUpdate(
      { _id: req.params.id, business: req.businessId },
      { active: false },
      { new: true }
    );
    if (!staff) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json({ ok: true });
  })
);

router.post(
  '/staff/:id/photo',
  staffPhotoUpload.single('photo'),
  verifyImageSignature,
  finalizeUpload('staff'),
  asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'INVALID_FILE' });
    const staff = await Staff.findOneAndUpdate(
      { _id: req.params.id, business: req.businessId },
      { photoUrl: req.file.publicUrl },
      { new: true }
    );
    if (!staff) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json({ staff });
  })
);

router.delete(
  '/staff/:id/photo',
  asyncHandler(async (req, res) => {
    const staff = await Staff.findOneAndUpdate(
      { _id: req.params.id, business: req.businessId },
      { $unset: { photoUrl: 1 } },
      { new: true }
    );
    if (!staff) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json({ staff });
  })
);

router.delete(
  '/me/cover-photo',
  asyncHandler(async (req, res) => {
    const business = await Business.findByIdAndUpdate(
      req.businessId,
      { $unset: { coverPhotoUrl: 1 } },
      { new: true }
    );
    res.json({ business });
  })
);

router.post(
  '/staff/:id/time-off',
  asyncHandler(async (req, res) => {
    const { from, to, note } = req.body || {};
    if (typeof from !== 'string' || typeof to !== 'string') {
      return res.status(400).json({ error: 'INVALID_INPUT' });
    }
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime()) || toDate < fromDate) {
      return res.status(400).json({ error: 'INVALID_INPUT' });
    }

    const staff = await Staff.findOneAndUpdate(
      { _id: req.params.id, business: req.businessId },
      { $push: { timeOff: { from: fromDate, to: toDate, note } } },
      { new: true }
    );
    if (!staff) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json({ staff });
  })
);

router.delete(
  '/staff/:id/time-off/:timeOffId',
  asyncHandler(async (req, res) => {
    const staff = await Staff.findOneAndUpdate(
      { _id: req.params.id, business: req.businessId },
      { $pull: { timeOff: { _id: req.params.timeOffId } } },
      { new: true }
    );
    if (!staff) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json({ staff });
  })
);

router.get(
  '/notifications',
  asyncHandler(async (req, res) => {
    const notifications = await Notification.find({ user: req.userId }).sort({ createdAt: -1 }).limit(50).lean();
    res.json({ notifications });
  })
);

router.post(
  '/notifications/:id/read',
  asyncHandler(async (req, res) => {
    await Notification.updateOne({ _id: req.params.id, user: req.userId }, { read: true });
    res.json({ ok: true });
  })
);

module.exports = router;
