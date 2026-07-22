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
const { computeBusinessRating } = require('../utils/businessRating');
const { createManualBooking } = require('../utils/manualBooking');
const { getWeekRange } = require('../utils/weekRange');
const { applyClientViolation } = require('../utils/clientPenalty');
const { containsStopWords } = require('../utils/stopWords');
const { applyPhoneReveal } = require('../utils/phoneReveal');
const { recomputeBusinessReviewStats } = require('../utils/reviewStats');
const { getOrCreateVirtualStaff } = require('../utils/virtualStaff');
const { isConfigured: sheetsConfigured, connectExistingSheet, extractSpreadsheetId } = require('../utils/googleSheets');
const Business = require('../models/Business');
const Category = require('../models/Category');
const PlatformSettings = require('../models/PlatformSettings');
const { customCategorySlug } = require('../utils/slugify');
const { findDuplicateCategory } = require('../utils/categoryDedup');
const { imageUploader, pdfUploader, finalizeUpload, verifyImageSignature, verifyPdfSignature } = require('../middleware/upload');

const staffPhotoUpload = imageUploader('staff');
const businessPhotoUpload = imageUploader('business');
const servicePhotoUpload = imageUploader('service');
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
    if (
      typeof req.body?.bufferMinutes === 'number' &&
      Number.isInteger(req.body.bufferMinutes) &&
      req.body.bufferMinutes >= 0 &&
      req.body.bufferMinutes <= 120
    ) {
      update.bufferMinutes = req.body.bufferMinutes;
    }
    if (
      typeof req.body?.bookingWindowDays === 'number' &&
      Number.isInteger(req.body.bookingWindowDays) &&
      req.body.bookingWindowDays >= 1 &&
      req.body.bookingWindowDays <= 365
    ) {
      update.bookingWindowDays = req.body.bookingWindowDays;
    }
    if ([12, 24, 48].includes(req.body?.cancellationPolicyHours)) {
      update.cancellationPolicyHours = req.body.cancellationPolicyHours;
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
    // Keep the zero-staff fallback (see utils/virtualStaff.js) in sync with the
    // business's real hours, if one already exists — a no-op for businesses that have
    // added real staff and never needed it.
    await Staff.updateOne({ business: req.businessId, virtual: true }, { schedule: workingHours });
    res.json({ business });
  })
);

router.get(
  '/backup-sheet-info',
  asyncHandler(async (req, res) => {
    const configured = sheetsConfigured();
    res.json({ configured, serviceAccountEmail: configured ? process.env.GOOGLE_SHEETS_CLIENT_EMAIL : null });
  })
);

router.post(
  '/me/backup-sheet',
  asyncHandler(async (req, res) => {
    if (!sheetsConfigured()) return res.status(400).json({ error: 'NOT_CONFIGURED' });

    const spreadsheetId = extractSpreadsheetId(req.body?.url);
    if (!spreadsheetId) return res.status(400).json({ error: 'INVALID_URL' });

    let result;
    try {
      result = await connectExistingSheet(spreadsheetId);
    } catch (err) {
      // A file that doesn't exist and one that exists but isn't shared with the
      // service account both come back as 403/404 from the Sheets API — either way
      // the fix on the business's side is the same: share it with the service account.
      const status = err.code || err.response?.status;
      const accessError = status === 403 || status === 404 || status === '403' || status === '404';
      return res.status(400).json({ error: accessError ? 'SHEET_NOT_SHARED' : 'CONNECT_FAILED' });
    }

    const business = await Business.findByIdAndUpdate(
      req.businessId,
      { backupSheetId: spreadsheetId, backupSheetUrl: result.spreadsheetUrl },
      { new: true }
    );
    res.json({ business });
  })
);

router.delete(
  '/me/backup-sheet',
  asyncHandler(async (req, res) => {
    const business = await Business.findByIdAndUpdate(
      req.businessId,
      { $unset: { backupSheetId: 1, backupSheetUrl: 1 } },
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
        status: { $in: ['confirmed', 'completed'] },
      }).lean(),
    ]);

    const revenueToday = todayBookings.reduce((sum, b) => sum + b.price, 0);
    const revenueMonth = monthBookings.reduce((sum, b) => sum + b.price, 0);

    res.json({
      bookingsToday: todayBookings.length,
      bookingsWeek: weekBookings.length,
      revenueToday,
      revenueMonth,
      rating: computeBusinessRating(req.businessDoc),
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

    const allStaff = await Staff.find({ business: req.businessId, active: true, virtual: { $ne: true } })
      .select('name photoUrl')
      .lean();

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
    const { serviceId, staffId, date, startTime, clientName, clientPhone, comment, quantity: rawQuantity } = req.body || {};

    if (
      typeof serviceId !== 'string' ||
      typeof date !== 'string' ||
      typeof startTime !== 'string' ||
      !DATE_RE.test(date) ||
      !TIME_RE.test(startTime) ||
      typeof clientName !== 'string' ||
      !clientName.trim() ||
      (staffId !== undefined && staffId !== '' && typeof staffId !== 'string')
    ) {
      return res.status(400).json({ error: 'INVALID_INPUT' });
    }

    const quantity = rawQuantity === undefined ? 1 : Number(rawQuantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
      return res.status(400).json({ error: 'INVALID_INPUT' });
    }

    const service = await Service.findOne({ _id: serviceId, business: req.businessId, active: true });
    if (!service) return res.status(404).json({ error: 'NOT_FOUND' });

    if (quantity > 1 && service.repeatable === false) {
      return res.status(400).json({ error: 'SERVICE_NOT_REPEATABLE' });
    }

    const durationMinutes = service.durationMinutes * quantity;
    const price = service.isFree ? 0 : service.price * quantity;

    const maxDuration = maxWorkingDayMinutes(req.businessDoc.workingHours);
    if (maxDuration > 0 && durationMinutes > maxDuration) {
      return res.status(400).json({ error: 'SERVICE_TOO_LONG', maxDurationMinutes: maxDuration });
    }

    let staff = null;
    let autoAssignedStaff = false;
    if (staffId) {
      staff = await Staff.findOne({ _id: staffId, business: req.businessId, active: true });
      if (!staff) return res.status(404).json({ error: 'NOT_FOUND' });
    } else {
      // No specific master picked — offer the slot to whichever eligible staff member
      // is actually free for it (mirrors the client-facing auto-assign flow), falling
      // back to the zero-staff placeholder if the business has no real staff at all.
      autoAssignedStaff = true;
      const staffFilter = { business: req.businessId, active: true, virtual: { $ne: true } };
      if (service.staff?.length) staffFilter._id = { $in: service.staff };
      const candidates = await Staff.find(staffFilter).lean();
      const reasons = [];
      for (const candidate of candidates) {
        // eslint-disable-next-line no-await-in-loop
        const reason = await slotUnavailableReason({
          staff: candidate,
          date,
          startTime,
          durationMinutes,
          bufferMinutes: req.businessDoc.bufferMinutes,
        });
        if (!reason) {
          staff = candidate;
          break;
        }
        reasons.push(reason);
      }
      if (!staff && !candidates.length) {
        const virtualStaff = await getOrCreateVirtualStaff(req.businessDoc);
        const reason = await slotUnavailableReason({
          staff: virtualStaff,
          date,
          startTime,
          durationMinutes,
          bufferMinutes: req.businessDoc.bufferMinutes,
        });
        if (!reason) staff = virtualStaff;
        else reasons.push(reason);
      }
      if (!staff) {
        // Every eligible candidate was rejected for the exact same reason (e.g. all off
        // that day, or the slot is outside working hours) — surface that specific reason
        // instead of a blanket "just taken", which used to fire even when nobody was ever
        // free to begin with and made the real cause impossible to tell from the message.
        const uniqueReasons = [...new Set(reasons)];
        const code = uniqueReasons.length === 1 ? reasonToErrorCode(uniqueReasons[0]) : 'SLOT_TAKEN';
        return res.status(409).json({ error: code });
      }
    }

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
        durationMinutes,
        price,
        quantity,
        autoAssignedStaff,
        bufferMinutes: req.businessDoc.bufferMinutes,
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

  if (status === 'completed' && booking.client) {
    await Notification.create({
      user: booking.client,
      type: 'booking_completed',
      title: 'Як пройшов візит?',
      text: `Залиште відгук про ${req.businessDoc.name} — ${booking.service?.name ?? 'послугу'}. Це допоможе іншим клієнтам.`,
      relatedBooking: booking._id,
    });
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
      bufferMinutes: req.businessDoc.bufferMinutes,
    });
    if (reason) return res.status(409).json({ error: reasonToErrorCode(reason) });

    booking.durationMinutes = durationMinutes;
    await booking.save();
    res.json({ booking: applyPhoneReveal(booking.toObject()) });
  })
);

// Lets the business hand an auto-assigned booking (see Booking.autoAssignedStaff) to a
// specific master — same date/time, just a real person confirmed to do it instead of
// whoever the system happened to pick as free when the client booked. Also usable to
// re-confirm/reassign an already-assigned booking to someone else.
router.patch(
  '/bookings/:id/assign-staff',
  asyncHandler(async (req, res) => {
    const { staffId } = req.body || {};
    if (typeof staffId !== 'string' || !staffId) return res.status(400).json({ error: 'INVALID_INPUT' });

    const booking = await Booking.findOne({ _id: req.params.id, business: req.businessId, status: 'confirmed' });
    if (!booking) return res.status(404).json({ error: 'NOT_FOUND' });

    const staff = await Staff.findOne({ _id: staffId, business: req.businessId, active: true });
    if (!staff) return res.status(404).json({ error: 'NOT_FOUND' });

    const reason = await slotUnavailableReason({
      staff,
      date: booking.date,
      startTime: booking.startTime,
      durationMinutes: booking.durationMinutes,
      excludeBookingId: booking._id,
      bufferMinutes: req.businessDoc.bufferMinutes,
    });
    if (reason) return res.status(409).json({ error: reasonToErrorCode(reason) });

    booking.staff = staff._id;
    booking.autoAssignedStaff = false;
    try {
      await booking.save();
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ error: 'SLOT_TAKEN' });
      throw err;
    }

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
          bufferMinutes: req.businessDoc.bufferMinutes,
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
        // The business explicitly naming a staffId here is a deliberate assignment,
        // same as PATCH .../assign-staff — clears the auto-assigned flag.
        if (typeof staffId === 'string' && staffId) booking.autoAssignedStaff = false;
        await booking.save({ session });
      });
    } catch (err) {
      if (err.code === 'OUTSIDE_WORKING_HOURS' || err.code === 'ON_BREAK') return res.status(409).json({ error: err.code });
      if (err.code === 'SLOT_TAKEN' || err.code === 11000) return res.status(409).json({ error: 'SLOT_TAKEN' });
      throw err;
    } finally {
      await session.endSession();
    }

    if (booking.client) {
      await Notification.create({
        user: booking.client,
        type: 'booking_rescheduled',
        title: 'Запис перенесено',
        text: `${req.businessDoc.name} переніс ваш запис на ${date} о ${startTime}.`,
        relatedBooking: booking._id,
      });
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

router.post(
  '/reviews/:id/dispute',
  asyncHandler(async (req, res) => {
    const { reason } = req.body || {};
    if (typeof reason !== 'string' || !reason.trim() || reason.trim().length > 1000) {
      return res.status(400).json({ error: 'INVALID_INPUT' });
    }

    const review = await Review.findOne({ _id: req.params.id, business: req.businessId, status: 'PUBLISHED' });
    if (!review) return res.status(404).json({ error: 'NOT_FOUND' });
    if (review.dispute?.status === 'OPEN') return res.status(409).json({ error: 'DISPUTE_ALREADY_OPEN' });

    review.dispute = { status: 'OPEN', reason: reason.trim(), openedAt: new Date() };
    await review.save();

    // Excluded from the public listing and rating the moment the dispute opens (see
    // utils/reviewStats.js) — resolves back to counted if the super-admin dismisses it.
    await recomputeBusinessReviewStats(req.businessId);

    if (review.client) {
      await Notification.create({
        user: review.client,
        type: 'review_disputed',
        title: 'Ваш відгук оскаржено',
        text: `${req.businessDoc.name} оскаржив ваш відгук. Ви можете надати пояснення — його розгляне адміністрація.`,
        relatedReview: review._id,
      });
    }

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
    const { name, description, price, durationMinutes, category, customCategoryName, staff, isFree, combinable, repeatable } = req.body || {};
    const free = isFree === true;
    if (
      typeof name !== 'string' ||
      !name.trim() ||
      typeof category !== 'string' ||
      !category.trim() ||
      (!free && (typeof price !== 'number' || price <= 0)) ||
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
      const duplicate = await findDuplicateCategory(customCategoryName);
      if (duplicate) return res.status(409).json({ error: 'CATEGORY_ALREADY_EXISTS', category: duplicate });
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
      price: free ? 0 : price,
      isFree: free,
      durationMinutes,
      category: categorySlug,
      staff: staffIds,
      combinable: combinable !== false,
      repeatable: repeatable !== false,
    });
    res.status(201).json({ service });
  })
);

router.patch(
  '/services/:id',
  asyncHandler(async (req, res) => {
    const allowed = ['name', 'description', 'price', 'durationMinutes', 'category', 'staff', 'isFree', 'combinable', 'repeatable'];
    const update = {};
    for (const key of allowed) if (key in (req.body || {})) update[key] = req.body[key];

    // isFree is the source of truth for price when set true — force price to 0 so the
    // two fields can never disagree, regardless of what the client also sent.
    if (update.isFree === true) update.price = 0;
    if ('price' in update && (typeof update.price !== 'number' || update.price < 0)) {
      return res.status(400).json({ error: 'INVALID_INPUT' });
    }

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

    // Mirrors the POST /services validation — without this, the update allowlist
    // above would let a caller set `category` to any string at all, bypassing the
    // approved-category / pending-moderation flow entirely. The edit UI never
    // offers a category field, so this only ever matters for direct API calls.
    if ('category' in update) {
      if (typeof update.category !== 'string' || !update.category.trim()) {
        return res.status(400).json({ error: 'INVALID_INPUT' });
      }
      const existingCategory = await Category.findOne({ slug: update.category, status: 'ACTIVE' });
      if (!existingCategory) return res.status(400).json({ error: 'INVALID_CATEGORY' });
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

router.post(
  '/services/:id/photo',
  servicePhotoUpload.single('photo'),
  verifyImageSignature,
  finalizeUpload('service'),
  asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'INVALID_FILE' });
    const service = await Service.findOneAndUpdate(
      { _id: req.params.id, business: req.businessId },
      { photoUrl: req.file.publicUrl },
      { new: true }
    );
    if (!service) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json({ service });
  })
);

router.delete(
  '/services/:id/photo',
  asyncHandler(async (req, res) => {
    const service = await Service.findOneAndUpdate(
      { _id: req.params.id, business: req.businessId },
      { $unset: { photoUrl: '' } },
      { new: true }
    );
    if (!service) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json({ service });
  })
);

router.get(
  '/staff',
  asyncHandler(async (req, res) => {
    const staff = await Staff.find({ business: req.businessId, active: true, virtual: { $ne: true } })
      .sort({ createdAt: 1 })
      .lean();
    res.json({ staff });
  })
);

router.post(
  '/staff',
  asyncHandler(async (req, res) => {
    const { name, role, bio } = req.body || {};
    if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'INVALID_INPUT' });

    // New staff default to the business's own working hours so they're immediately
    // bookable. Without this, a freshly added master has no schedule at all — every
    // availability check finds zero slots, so the business silently disappears from
    // the catalog (which only lists businesses with a real bookable slot) until the
    // owner separately visits the "Schedule" tab, which isn't an obvious next step.
    const businessHours = req.businessDoc.workingHours?.toObject?.() ?? req.businessDoc.workingHours;
    const defaultSchedule = businessHours
      ? Object.fromEntries(
          Object.entries(businessHours)
            .filter(([key]) => WEEKDAY_KEYS.has(key))
            .map(([key, day]) => [
              key,
              { start: day.start, end: day.end, dayOff: !!day.dayOff, breakStart: day.breakStart, breakEnd: day.breakEnd },
            ])
        )
      : undefined;

    const staff = await Staff.create({ business: req.businessId, name: name.trim(), role, bio, schedule: defaultSchedule });
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
