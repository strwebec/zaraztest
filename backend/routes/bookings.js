const express = require('express');
const mongoose = require('mongoose');

const Booking = require('../models/Booking');
const Business = require('../models/Business');
const Service = require('../models/Service');
const Staff = require('../models/Staff');
const User = require('../models/User');
const Notification = require('../models/Notification');
const {
  slotUnavailableReason,
  reasonToErrorCode,
  findClientConflict,
  timeToMinutes,
  minutesToTime,
} = require('../utils/availability');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { bookingLimiter } = require('../middleware/rateLimit');
const { asyncHandler } = require('../utils/asyncHandler');
const { resolveCommissionRate } = require('../utils/commission');

const router = express.Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

router.post('/', requireAuth, requireRole('CLIENT'), bookingLimiter, asyncHandler(async (req, res) => {
  const { businessId, serviceId, staffId, date, startTime, comment } = req.body || {};

  if (
    typeof businessId !== 'string' ||
    typeof serviceId !== 'string' ||
    typeof staffId !== 'string' ||
    typeof date !== 'string' ||
    typeof startTime !== 'string' ||
    !DATE_RE.test(date) ||
    !TIME_RE.test(startTime)
  ) {
    return res.status(400).json({ error: 'INVALID_INPUT' });
  }

  // The requested slot's date/time is client-supplied — recompute and reject anything
  // already in the past server-side rather than trusting the browser's clock or intent.
  if (new Date(`${date}T${startTime}:00`).getTime() <= Date.now()) {
    return res.status(400).json({ error: 'SLOT_IN_PAST' });
  }

  const client = await User.findById(req.userId);
  if (!client) return res.status(401).json({ error: 'UNAUTHENTICATED' });
  if (client.blockedUntil && client.blockedUntil > new Date()) {
    return res.status(403).json({ error: 'ACCOUNT_BLOCKED', until: client.blockedUntil });
  }

  const [business, service, staff] = await Promise.all([
    Business.findOne({ _id: businessId, status: 'ACTIVE' }),
    Service.findOne({ _id: serviceId, business: businessId, active: true }),
    Staff.findOne({ _id: staffId, business: businessId, active: true }),
  ]);
  if (!business || !service || !staff) return res.status(404).json({ error: 'NOT_FOUND' });

  const session = await mongoose.startSession();
  try {
    let booking;
    await session.withTransaction(async () => {
      const reason = await slotUnavailableReason({
        staff,
        date,
        startTime,
        durationMinutes: service.durationMinutes,
        session,
      });
      if (reason) {
        const code = reasonToErrorCode(reason);
        const err = new Error(code);
        err.code = code;
        throw err;
      }

      const conflict = await findClientConflict({
        clientId: client._id,
        date,
        startTime,
        durationMinutes: service.durationMinutes,
        session,
      });
      if (conflict) {
        const err = new Error('CLIENT_TIME_CONFLICT');
        err.code = 'CLIENT_TIME_CONFLICT';
        err.conflictBusinessId = conflict.business;
        err.conflictServiceId = conflict.service;
        err.conflictStartTime = conflict.startTime;
        throw err;
      }

      const created = await Booking.create(
        [
          {
            client: client._id,
            clientName: client.name,
            clientPhone: client.phone,
            business: business._id,
            service: service._id,
            staff: staff._id,
            date,
            startTime,
            durationMinutes: service.durationMinutes,
            price: service.price,
            isFree: !!service.isFree,
            source: 'platform',
            status: 'confirmed',
            comment,
            commissionRate: resolveCommissionRate(business.createdAt, Number(process.env.COMMISSION_PLATFORM) || 0.02),
            autoAssignedStaff: true,
          },
        ],
        { session }
      );
      booking = created[0];
    });

    await Notification.create({
      user: client._id,
      type: 'booking_confirmed',
      title: 'Запис підтверджено',
      text: `${business.name} — ${service.name}, ${date} о ${startTime}`,
    });
    if (business.owner) {
      await Notification.create({
        user: business.owner,
        type: 'new_booking_received',
        title: 'Новий запис',
        text: `${client.name} записався на ${service.name}, ${date} о ${startTime}`,
        relatedBooking: booking._id,
      });
    }

    res.status(201).json({ booking });
  } catch (err) {
    if (err.code === 'OUTSIDE_WORKING_HOURS' || err.code === 'ON_BREAK') return res.status(409).json({ error: err.code });
    if (err.code === 'SLOT_TAKEN' || err.code === 11000) {
      return res.status(409).json({ error: 'SLOT_TAKEN' });
    }
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
}));

// Multi-service checkout — several services back-to-back with the same master in one
// visit (e.g. manicure + brows), created as sibling Booking documents sharing a groupId
// so the whole combo either books together or not at all.
router.post('/group', requireAuth, requireRole('CLIENT'), bookingLimiter, asyncHandler(async (req, res) => {
  const { businessId, serviceIds, staffId, date, startTime, comment } = req.body || {};

  if (
    typeof businessId !== 'string' ||
    !Array.isArray(serviceIds) ||
    serviceIds.length < 1 ||
    serviceIds.length > 20 ||
    !serviceIds.every((id) => typeof id === 'string') ||
    typeof staffId !== 'string' ||
    typeof date !== 'string' ||
    typeof startTime !== 'string' ||
    !DATE_RE.test(date) ||
    !TIME_RE.test(startTime)
  ) {
    return res.status(400).json({ error: 'INVALID_INPUT' });
  }

  if (new Date(`${date}T${startTime}:00`).getTime() <= Date.now()) {
    return res.status(400).json({ error: 'SLOT_IN_PAST' });
  }

  const client = await User.findById(req.userId);
  if (!client) return res.status(401).json({ error: 'UNAUTHENTICATED' });
  if (client.blockedUntil && client.blockedUntil > new Date()) {
    return res.status(403).json({ error: 'ACCOUNT_BLOCKED', until: client.blockedUntil });
  }

  // serviceIds may repeat the same id — booking one service multiple times (e.g. a
  // sauna for 3 hours instead of 1 by picking it 3x instead of making 3 separate
  // bookings). $in dedupes automatically, so validate against the unique id set.
  const uniqueServiceIds = [...new Set(serviceIds)];
  const [business, staff, services] = await Promise.all([
    Business.findOne({ _id: businessId, status: 'ACTIVE' }),
    Staff.findOne({ _id: staffId, business: businessId, active: true }),
    Service.find({ _id: { $in: uniqueServiceIds }, business: businessId, active: true }).lean(),
  ]);
  if (!business || !staff || services.length !== uniqueServiceIds.length) return res.status(404).json({ error: 'NOT_FOUND' });

  // Preserve the order (and repeats) the client selected them in, not Mongo's $in order.
  const byId = new Map(services.map((s) => [String(s._id), s]));
  const orderedServices = serviceIds.map((id) => byId.get(id));

  const canPerformAll = orderedServices.every((s) => !s.staff?.length || s.staff.some((id) => String(id) === staffId));
  if (!canPerformAll) return res.status(400).json({ error: 'STAFF_CANNOT_PERFORM' });

  // A non-combinable service must be booked alone — repeating the SAME service (e.g.
  // the sauna x3) is fine, only mixing in a genuinely different service is rejected.
  if (uniqueServiceIds.length > 1 && orderedServices.some((s) => s.combinable === false)) {
    return res.status(400).json({ error: 'SERVICE_NOT_COMBINABLE' });
  }

  const totalDuration = orderedServices.reduce((sum, s) => sum + s.durationMinutes, 0);

  const session = await mongoose.startSession();
  try {
    let bookings;
    await session.withTransaction(async () => {
      const reason = await slotUnavailableReason({ staff, date, startTime, durationMinutes: totalDuration, session });
      if (reason) {
        const code = reasonToErrorCode(reason);
        const err = new Error(code);
        err.code = code;
        throw err;
      }

      const conflict = await findClientConflict({
        clientId: client._id,
        date,
        startTime,
        durationMinutes: totalDuration,
        session,
      });
      if (conflict) {
        const err = new Error('CLIENT_TIME_CONFLICT');
        err.code = 'CLIENT_TIME_CONFLICT';
        err.conflictBusinessId = conflict.business;
        err.conflictServiceId = conflict.service;
        err.conflictStartTime = conflict.startTime;
        throw err;
      }

      const groupId = new mongoose.Types.ObjectId();
      let offsetMinutes = timeToMinutes(startTime);
      const docs = orderedServices.map((service) => {
        const doc = {
          client: client._id,
          clientName: client.name,
          clientPhone: client.phone,
          business: business._id,
          service: service._id,
          staff: staff._id,
          date,
          startTime: minutesToTime(offsetMinutes),
          durationMinutes: service.durationMinutes,
          price: service.price,
          isFree: !!service.isFree,
          source: 'platform',
          status: 'confirmed',
          comment,
          commissionRate: resolveCommissionRate(business.createdAt, Number(process.env.COMMISSION_PLATFORM) || 0.02),
          groupId,
          autoAssignedStaff: true,
        };
        offsetMinutes += service.durationMinutes;
        return doc;
      });

      bookings = await Booking.create(docs, { session, ordered: true });
    });

    await Notification.create({
      user: client._id,
      type: 'booking_confirmed',
      title: 'Запис підтверджено',
      text: `${business.name} — ${orderedServices.map((s) => s.name).join(', ')}, ${date} о ${startTime}`,
    });
    if (business.owner) {
      await Notification.create({
        user: business.owner,
        type: 'new_booking_received',
        title: 'Новий запис',
        text: `${client.name} записався на ${orderedServices.map((s) => s.name).join(', ')}, ${date} о ${startTime}`,
        relatedBooking: bookings[0]._id,
      });
    }

    res.status(201).json({ bookings });
  } catch (err) {
    if (err.code === 'OUTSIDE_WORKING_HOURS' || err.code === 'ON_BREAK') return res.status(409).json({ error: err.code });
    if (err.code === 'SLOT_TAKEN' || err.code === 11000) {
      return res.status(409).json({ error: 'SLOT_TAKEN' });
    }
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
}));

module.exports = router;
