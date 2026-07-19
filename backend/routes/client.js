const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const Booking = require('../models/Booking');
const Business = require('../models/Business');
const Service = require('../models/Service');
const Staff = require('../models/Staff');
const Notification = require('../models/Notification');
const Review = require('../models/Review');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { reviewLimiter } = require('../middleware/rateLimit');
const { asyncHandler } = require('../utils/asyncHandler');
const { isSlotFree, findClientConflict, isWithinBookingWindow } = require('../utils/availability');
const { computeBusinessRating } = require('../utils/businessRating');
const { applyClientViolation } = require('../utils/clientPenalty');
const { applyUnfairCancellation } = require('../jobs/autoUnblock');
const { containsStopWords } = require('../utils/stopWords');
const { recomputeBusinessReviewStats } = require('../utils/reviewStats');
const { imageUploader, finalizeUpload, verifyImageSignature } = require('../middleware/upload');

const avatarUpload = imageUploader('avatars');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const router = express.Router();
router.use(requireAuth, requireRole('CLIENT'));

function bookingDateTime(booking) {
  return new Date(`${booking.date}T${booking.startTime}:00`);
}

router.get(
  '/bookings',
  asyncHandler(async (req, res) => {
    const { tab } = req.query;
    const now = new Date();

    const all = await Booking.find({ client: req.userId })
      .populate('business', 'name category coverPhotoUrl cancellationPolicyHours bookingWindowDays')
      .populate('service', 'name')
      .populate('staff', 'name')
      .sort({ date: -1, startTime: -1 })
      .lean();

    const reviewByBooking = new Map(
      (await Review.find({ client: req.userId }).select('booking rating text dispute').lean()).map((r) => [
        String(r.booking),
        r,
      ])
    );

    const classified = all.map((b) => {
      const dt = bookingDateTime(b);
      const isCancelled = b.status === 'cancelled_by_client' || b.status === 'cancelled_by_business';
      const isPast = !isCancelled && (dt < now || b.status === 'completed' || b.status === 'no_show');
      const review = reviewByBooking.get(String(b._id)) || null;
      return {
        ...b,
        _group: isCancelled ? 'cancelled' : isPast ? 'past' : 'upcoming',
        hasReview: !!review,
        review,
      };
    });

    const filtered = tab ? classified.filter((b) => b._group === tab) : classified;
    res.json({ bookings: filtered });
  })
);

router.post(
  '/bookings/:id/cancel',
  asyncHandler(async (req, res) => {
    const booking = await Booking.findOne({ _id: req.params.id, client: req.userId }).populate('business');
    if (!booking) return res.status(404).json({ error: 'NOT_FOUND' });
    if (booking.status !== 'confirmed') return res.status(400).json({ error: 'NOT_CANCELLABLE' });

    const hoursUntil = (bookingDateTime(booking).getTime() - Date.now()) / (1000 * 60 * 60);
    const policyHours = booking.business.cancellationPolicyHours;
    const isLate = hoursUntil < policyHours;

    booking.status = 'cancelled_by_client';
    await booking.save();

    if (isLate) await applyClientViolation(req.userId, 'late_cancel');

    if (booking.business?.owner) {
      await Notification.create({
        user: booking.business.owner,
        type: 'booking_cancelled_by_client',
        title: 'Клієнт скасував запис',
        text: `${booking.clientName || 'Клієнт'} скасував запис на ${booking.date} о ${booking.startTime}.`,
        relatedBooking: booking._id,
      });
    }

    res.json({ booking, isLate, policyHours });
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
      !TIME_RE.test(startTime) ||
      typeof staffId !== 'string'
    ) {
      return res.status(400).json({ error: 'INVALID_INPUT' });
    }

    const booking = await Booking.findOne({ _id: req.params.id, client: req.userId }).populate('business');
    if (!booking) return res.status(404).json({ error: 'NOT_FOUND' });
    if (booking.status !== 'confirmed') return res.status(400).json({ error: 'NOT_RESCHEDULABLE' });
    if (!isWithinBookingWindow(date, booking.business.bookingWindowDays)) {
      return res.status(400).json({ error: 'DATE_TOO_FAR', bookingWindowDays: booking.business.bookingWindowDays });
    }

    const staff = await Staff.findOne({ _id: staffId, business: booking.business._id, active: true });
    if (!staff) return res.status(404).json({ error: 'NOT_FOUND' });

    const hoursUntil = (bookingDateTime(booking).getTime() - Date.now()) / (1000 * 60 * 60);
    const policyHours = booking.business.cancellationPolicyHours;
    const isLate = hoursUntil < policyHours;

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const free = await isSlotFree({
          staff,
          date,
          startTime,
          durationMinutes: booking.durationMinutes,
          session,
          excludeBookingId: booking._id,
          bufferMinutes: booking.business.bufferMinutes,
        });
        if (!free) {
          const err = new Error('SLOT_TAKEN');
          err.code = 'SLOT_TAKEN';
          throw err;
        }

        const conflict = await findClientConflict({
          clientId: req.userId,
          date,
          startTime,
          durationMinutes: booking.durationMinutes,
          session,
          excludeBookingId: booking._id,
        });
        if (conflict) {
          const err = new Error('CLIENT_TIME_CONFLICT');
          err.code = 'CLIENT_TIME_CONFLICT';
          err.conflictBusinessId = conflict.business;
          err.conflictServiceId = conflict.service;
          err.conflictStartTime = conflict.startTime;
          throw err;
        }

        booking.date = date;
        booking.startTime = startTime;
        booking.staff = staff._id;
        await booking.save({ session });
      });
    } catch (err) {
      if (err.code === 'SLOT_TAKEN' || err.code === 11000) return res.status(409).json({ error: 'SLOT_TAKEN' });
      if (err.code === 'CLIENT_TIME_CONFLICT') {
        const [conflictBusiness, conflictService] = await Promise.all([
          Business.findById(err.conflictBusinessId).select('name').lean(),
          Service.findById(err.conflictServiceId).select('name').lean(),
        ]);
        return res.status(409).json({
          error: 'CLIENT_TIME_CONFLICT',
          conflict: {
            businessName: conflictBusiness?.name,
            serviceName: conflictService?.name,
            startTime: err.conflictStartTime,
          },
        });
      }
      throw err;
    } finally {
      await session.endSession();
    }

    if (booking.business?.owner) {
      await Notification.create({
        user: booking.business.owner,
        type: 'booking_rescheduled',
        title: 'Клієнт переніс запис',
        text: `${booking.clientName || 'Клієнт'} переніс запис на ${date} о ${startTime}.`,
        relatedBooking: booking._id,
      });
    }

    res.json({ booking, isLate, policyHours });
  })
);

router.post(
  '/bookings/:id/confirm-cancellation',
  asyncHandler(async (req, res) => {
    const { response } = req.body || {};
    if (response !== 'yes' && response !== 'no') return res.status(400).json({ error: 'INVALID_INPUT' });

    const booking = await Booking.findOne({ _id: req.params.id, client: req.userId });
    if (!booking) return res.status(404).json({ error: 'NOT_FOUND' });
    if (booking.status !== 'cancelled_by_business') return res.status(400).json({ error: 'NOT_APPLICABLE' });
    if (booking.cancellationConfirmation?.respondedAt) return res.status(400).json({ error: 'ALREADY_RESPONDED' });

    booking.cancellationConfirmation.respondedAt = new Date();
    booking.cancellationConfirmation.response = response;
    booking.cancellationConfirmation.processed = true;
    await booking.save();

    if (response === 'no') {
      await applyUnfairCancellation(booking.business);
    }

    res.json({ ok: true });
  })
);

router.post(
  '/bookings/:id/review',
  reviewLimiter,
  asyncHandler(async (req, res) => {
    const { rating, text } = req.body || {};
    const ratingNum = Number(rating);
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ error: 'INVALID_INPUT' });
    }
    const trimmedText = typeof text === 'string' ? text.trim() : '';
    if (trimmedText.length > 1000) {
      return res.status(400).json({ error: 'INVALID_INPUT' });
    }

    const booking = await Booking.findOne({ _id: req.params.id, client: req.userId });
    if (!booking) return res.status(404).json({ error: 'NOT_FOUND' });
    if (booking.status !== 'completed') return res.status(400).json({ error: 'NOT_REVIEWABLE' });

    const existing = await Review.findOne({ booking: booking._id });
    if (existing) return res.status(409).json({ error: 'ALREADY_REVIEWED' });

    const status = containsStopWords(trimmedText) ? 'PENDING' : 'PUBLISHED';

    const review = await Review.create({
      business: booking.business,
      client: req.userId,
      booking: booking._id,
      rating: ratingNum,
      text: trimmedText,
      status,
    });

    if (status === 'PUBLISHED') await recomputeBusinessReviewStats(booking.business);

    res.status(201).json({ review, needsModeration: status === 'PENDING' });
  })
);

router.post(
  '/reviews/:id/dispute-response',
  asyncHandler(async (req, res) => {
    const { response } = req.body || {};
    if (typeof response !== 'string' || !response.trim() || response.trim().length > 1000) {
      return res.status(400).json({ error: 'INVALID_INPUT' });
    }

    const review = await Review.findOne({ _id: req.params.id, client: req.userId }).populate('business', 'name owner');
    if (!review) return res.status(404).json({ error: 'NOT_FOUND' });
    if (review.dispute?.status !== 'OPEN') return res.status(400).json({ error: 'NO_OPEN_DISPUTE' });

    review.dispute.clientResponse = response.trim();
    review.dispute.clientRespondedAt = new Date();
    await review.save();

    if (review.business?.owner) {
      await Notification.create({
        user: review.business.owner,
        type: 'review_dispute_response',
        title: 'Клієнт відповів на оскарження',
        text: `Клієнт надав пояснення щодо відгуку, який ви оскаржили. Рішення прийме адміністрація.`,
        relatedReview: review._id,
      });
    }

    res.json({ review });
  })
);

router.get(
  '/favorites',
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.userId).populate('favoriteBusinesses').lean();
    const businesses = user.favoriteBusinesses || [];

    const withServices = await Promise.all(
      businesses.map(async (biz) => {
        const cheapest = await Service.findOne({ business: biz._id, active: true }).sort({ price: 1 }).lean();
        return {
          id: biz._id,
          name: biz.name,
          category: biz.category,
          district: biz.district,
          rating: computeBusinessRating(biz),
          reviews: biz.googleReviewsCount + biz.platformReviewsCount,
          priceFrom: cheapest?.price ?? null,
          top: !!biz.top?.active,
        };
      })
    );

    res.json({ businesses: withServices });
  })
);

router.post(
  '/favorites/:businessId',
  asyncHandler(async (req, res) => {
    const business = await Business.findById(req.params.businessId).lean();
    if (!business) return res.status(404).json({ error: 'NOT_FOUND' });
    await User.updateOne({ _id: req.userId }, { $addToSet: { favoriteBusinesses: business._id } });
    res.json({ ok: true });
  })
);

router.delete(
  '/favorites/:businessId',
  asyncHandler(async (req, res) => {
    await User.updateOne({ _id: req.userId }, { $pull: { favoriteBusinesses: req.params.businessId } });
    res.json({ ok: true });
  })
);

router.get(
  '/notifications',
  asyncHandler(async (req, res) => {
    const notifications = await Notification.find({ user: req.userId })
      .populate('relatedBooking', 'status cancellationConfirmation')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
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

router.patch(
  '/profile',
  asyncHandler(async (req, res) => {
    const { name, phone, language, themePref } = req.body || {};
    const update = {};
    if (typeof name === 'string' && name.trim()) update.name = name.trim();
    if (typeof phone === 'string') update.phone = phone.trim();
    if (language === 'uk' || language === 'en') update.language = language;
    if (themePref === 'dark' || themePref === 'light') update.themePref = themePref;

    const user = await User.findByIdAndUpdate(req.userId, update, { new: true });
    res.json({
      user: {
        id: user._id,
        role: user.role,
        name: user.name,
        email: user.email,
        phone: user.phone,
        city: user.city,
        language: user.language,
        themePref: user.themePref,
        emailVerified: user.emailVerified,
        rating: user.rating,
        avatarUrl: user.avatarUrl,
      },
    });
  })
);

router.post(
  '/profile/avatar',
  avatarUpload.single('avatar'),
  verifyImageSignature,
  finalizeUpload('avatars'),
  asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'INVALID_FILE' });
    const user = await User.findByIdAndUpdate(
      req.userId,
      { avatarUrl: req.file.publicUrl },
      { new: true }
    );
    res.json({ avatarUrl: user.avatarUrl });
  })
);

router.delete(
  '/profile/avatar',
  asyncHandler(async (req, res) => {
    await User.updateOne({ _id: req.userId }, { $unset: { avatarUrl: 1 } });
    res.json({ ok: true });
  })
);

router.post(
  '/profile/password',
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({ error: 'INVALID_INPUT' });
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(401).json({ error: 'UNAUTHENTICATED' });

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();
    res.json({ ok: true });
  })
);

router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const bookings = await Booking.find({ client: req.userId }).select('status price').lean();
    const completed = bookings.filter((b) => b.status === 'completed');
    res.json({
      totalBookings: bookings.length,
      completedBookings: completed.length,
      totalSpent: completed.reduce((sum, b) => sum + (b.price || 0), 0),
    });
  })
);

module.exports = router;
