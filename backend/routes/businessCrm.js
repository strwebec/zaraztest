const express = require('express');

const Booking = require('../models/Booking');
const BusinessClient = require('../models/BusinessClient');
const CustomFieldDefinition = require('../models/CustomFieldDefinition');
const Expense = require('../models/Expense');
const Staff = require('../models/Staff');
const Service = require('../models/Service');
const BusinessMetricDefinition = require('../models/BusinessMetricDefinition');
const MonthlyLedgerEntry = require('../models/MonthlyLedgerEntry');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { attachBusiness } = require('../middleware/business');
const { asyncHandler } = require('../utils/asyncHandler');
const { normalizePhone } = require('../utils/phone');
const { getWorkingWindow, overlapsBreak, timeToMinutes, minutesToTime } = require('../utils/availability');
const { applyPhoneReveal } = require('../utils/phoneReveal');
const { encryptValue } = require('../utils/ledgerCrypto');
const { computeMonthMetrics } = require('../utils/ledgerCalc');
const { buildInsights, buildPeriodInsights } = require('../utils/ledgerInsights');
const crypto = require('crypto');

// Field labels are free-text and often Ukrainian ("Група крові") — rather than
// fight transliteration for a stable ASCII key, just mint a short random one;
// the label is what's actually shown anywhere in the UI.
function generateFieldKey() {
  return `field-${crypto.randomBytes(4).toString('hex')}`;
}

const router = express.Router();
router.use(requireAuth, requireRole('BUSINESS_OWNER'), attachBusiness);

const FIELD_TYPES = ['text', 'number', 'date', 'select', 'textarea'];

// ---- Client roster: derived live from Booking so it can never drift ----

router.get(
  '/clients',
  asyncHandler(async (req, res) => {
    const search = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';

    // Grouped in application code (not an aggregation pipeline) so the same
    // normalizePhone() logic is the single source of truth everywhere this
    // feature matches bookings to a client — an aggregation-only string
    // transform (e.g. stripping just spaces) would silently disagree with it
    // whenever a phone is recorded with vs. without a "+" prefix.
    const bookings = await Booking.find({ business: req.businessId })
      .select('clientPhone clientName status price createdAt')
      .sort({ createdAt: 1 })
      .lean();

    const byPhone = new Map();
    for (const b of bookings) {
      const phone = normalizePhone(b.clientPhone);
      if (!phone) continue;
      const entry = byPhone.get(phone) ?? {
        phone,
        displayPhone: b.clientPhone,
        name: b.clientName,
        visitsCount: 0,
        totalSpent: 0,
        lastVisitAt: b.createdAt,
        bookingsCount: 0,
      };
      entry.displayPhone = b.clientPhone;
      entry.name = b.clientName;
      entry.bookingsCount += 1;
      if (b.status === 'completed') {
        entry.visitsCount += 1;
        entry.totalSpent += b.price;
      }
      if (b.createdAt > entry.lastVisitAt) entry.lastVisitAt = b.createdAt;
      byPhone.set(phone, entry);
    }

    let clients = [...byPhone.values()].sort((a, b) => new Date(b.lastVisitAt) - new Date(a.lastVisitAt));
    if (search) {
      clients = clients.filter((c) => c.name?.toLowerCase().includes(search) || c.displayPhone?.includes(search));
    }

    res.json({ clients });
  })
);

router.get(
  '/clients/:phone',
  asyncHandler(async (req, res) => {
    const phone = normalizePhone(req.params.phone);
    if (!phone) return res.status(400).json({ error: 'INVALID_INPUT' });

    const bookings = await Booking.find({ business: req.businessId })
      .populate('service', 'name')
      .populate('staff', 'name')
      .sort({ date: -1, startTime: -1 })
      .lean();

    const matching = bookings.filter((b) => normalizePhone(b.clientPhone) === phone);
    if (matching.length === 0) return res.status(404).json({ error: 'NOT_FOUND' });

    const [clientDoc, fieldDefs] = await Promise.all([
      BusinessClient.findOne({ business: req.businessId, phone }).lean(),
      CustomFieldDefinition.find({ business: req.businessId }).sort({ order: 1 }).lean(),
    ]);

    res.json({
      phone,
      displayPhone: matching[0].clientPhone,
      name: matching[0].clientName,
      notes: clientDoc?.notes ?? '',
      customFieldValues: clientDoc?.customFieldValues ?? {},
      fieldDefinitions: fieldDefs,
      bookings: matching.map((b) => ({
        _id: b._id,
        date: b.date,
        startTime: b.startTime,
        status: b.status,
        price: b.price,
        source: b.source,
        service: b.service ? { _id: b.service._id, name: b.service.name } : null,
        staff: b.staff ? { _id: b.staff._id, name: b.staff.name } : null,
        comment: b.comment,
      })),
    });
  })
);

router.patch(
  '/clients/:phone',
  asyncHandler(async (req, res) => {
    const phone = normalizePhone(req.params.phone);
    if (!phone) return res.status(400).json({ error: 'INVALID_INPUT' });

    const candidates = await Booking.find({ business: req.businessId }).select('clientPhone').lean();
    const hasBooking = candidates.some((b) => normalizePhone(b.clientPhone) === phone);
    if (!hasBooking) return res.status(404).json({ error: 'NOT_FOUND' });

    const update = {};
    if (typeof req.body?.notes === 'string') update.notes = req.body.notes.slice(0, 4000);
    if (req.body?.customFieldValues && typeof req.body.customFieldValues === 'object') {
      update.customFieldValues = req.body.customFieldValues;
    }

    const client = await BusinessClient.findOneAndUpdate(
      { business: req.businessId, phone },
      { $set: update },
      { new: true, upsert: true }
    ).lean();

    res.json({ notes: client.notes, customFieldValues: client.customFieldValues ?? {} });
  })
);

// ---- Custom field definitions: how record-keeping adapts per category ----

router.get(
  '/custom-fields',
  asyncHandler(async (req, res) => {
    const fields = await CustomFieldDefinition.find({ business: req.businessId }).sort({ order: 1 }).lean();
    res.json({ fields });
  })
);

router.post(
  '/custom-fields',
  asyncHandler(async (req, res) => {
    const { label, type, options } = req.body || {};
    if (typeof label !== 'string' || !label.trim()) return res.status(400).json({ error: 'INVALID_INPUT' });
    if (!FIELD_TYPES.includes(type)) return res.status(400).json({ error: 'INVALID_INPUT' });

    const key = generateFieldKey();
    const count = await CustomFieldDefinition.countDocuments({ business: req.businessId });

    try {
      const field = await CustomFieldDefinition.create({
        business: req.businessId,
        key,
        label: label.trim(),
        type,
        options: type === 'select' && Array.isArray(options) ? options.filter((o) => typeof o === 'string' && o.trim()).map((o) => o.trim()) : [],
        order: count,
      });
      res.status(201).json({ field });
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ error: 'FIELD_EXISTS' });
      throw err;
    }
  })
);

router.patch(
  '/custom-fields/:id',
  asyncHandler(async (req, res) => {
    const update = {};
    if (typeof req.body?.label === 'string' && req.body.label.trim()) update.label = req.body.label.trim();
    if (Array.isArray(req.body?.options)) {
      update.options = req.body.options.filter((o) => typeof o === 'string' && o.trim()).map((o) => o.trim());
    }
    if (typeof req.body?.order === 'number') update.order = req.body.order;

    const field = await CustomFieldDefinition.findOneAndUpdate(
      { _id: req.params.id, business: req.businessId },
      update,
      { new: true }
    );
    if (!field) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json({ field });
  })
);

router.delete(
  '/custom-fields/:id',
  asyncHandler(async (req, res) => {
    const field = await CustomFieldDefinition.findOneAndDelete({ _id: req.params.id, business: req.businessId });
    if (!field) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json({ ok: true });
  })
);

// ---- Expenses: the other half of a real P&L, not just gross commission revenue ----

router.get(
  '/expenses',
  asyncHandler(async (req, res) => {
    const allowedRanges = [7, 30, 90];
    const requestedDays = Number(req.query.days);
    const rangeDays = allowedRanges.includes(requestedDays) ? requestedDays : 30;

    const todayKey = new Date().toISOString().slice(0, 10);
    const sinceKey = new Date(Date.now() - (rangeDays - 1) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const expenses = await Expense.find({ business: req.businessId, date: { $gte: sinceKey, $lte: todayKey } })
      .sort({ date: -1, createdAt: -1 })
      .lean();

    const total = expenses.reduce((sum, e) => sum + e.amount, 0);
    res.json({ expenses, total: Math.round(total) });
  })
);

router.post(
  '/expenses',
  asyncHandler(async (req, res) => {
    const { category, amount, date, note } = req.body || {};
    if (typeof category !== 'string' || !category.trim()) return res.status(400).json({ error: 'INVALID_INPUT' });
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) return res.status(400).json({ error: 'INVALID_INPUT' });
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'INVALID_INPUT' });

    const expense = await Expense.create({
      business: req.businessId,
      category: category.trim(),
      amount: numAmount,
      date,
      note: typeof note === 'string' ? note.slice(0, 500) : '',
    });
    res.status(201).json({ expense });
  })
);

router.delete(
  '/expenses/:id',
  asyncHandler(async (req, res) => {
    const expense = await Expense.findOneAndDelete({ _id: req.params.id, business: req.businessId });
    if (!expense) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json({ ok: true });
  })
);

// ---- Week availability: answer "is Dr. X free next Tuesday?" in one glance ----

const GRID_START_HOUR = 7;
const GRID_END_HOUR = 21;
const GRID_STEP_MINUTES = 30;
const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toDateKeyLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function mondayOf(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + offset);
  return monday;
}

router.get(
  '/staff/:staffId/week-availability',
  asyncHandler(async (req, res) => {
    const staff = await Staff.findOne({ _id: req.params.staffId, business: req.businessId, active: true }).lean();
    if (!staff) return res.status(404).json({ error: 'NOT_FOUND' });

    let durationMinutes = GRID_STEP_MINUTES;
    let serviceId = null;
    if (typeof req.query.serviceId === 'string' && req.query.serviceId) {
      const service = await Service.findOne({ _id: req.query.serviceId, business: req.businessId }).lean();
      if (service) {
        durationMinutes = service.durationMinutes;
        serviceId = service._id;
      }
    }

    const fromRaw = typeof req.query.from === 'string' && DATE_RE.test(req.query.from) ? req.query.from : toDateKeyLocal(new Date());
    const monday = mondayOf(fromRaw);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const dt = new Date(monday.getTime());
      dt.setDate(monday.getDate() + i);
      const dateKey = toDateKeyLocal(dt);
      const window = getWorkingWindow(staff, dateKey);

      const bookings = window
        ? await Booking.find({
            staff: staff._id,
            date: dateKey,
            status: { $in: ['confirmed', 'completed'] },
          })
            .populate('service', 'name price')
            .lean()
        : [];

      const slots = [];
      for (let t = GRID_START_HOUR * 60; t < GRID_END_HOUR * 60; t += GRID_STEP_MINUTES) {
        const time = minutesToTime(t);
        if (!window) {
          slots.push({ time, status: 'off' });
          continue;
        }
        const winStart = timeToMinutes(window.start);
        const winEnd = timeToMinutes(window.end);
        if (t < winStart || t >= winEnd || overlapsBreak(window, t, t + GRID_STEP_MINUTES)) {
          slots.push({ time, status: 'off' });
          continue;
        }
        const occupying = bookings.find((b) => {
          const bs = timeToMinutes(b.startTime);
          const be = bs + b.durationMinutes;
          return t < be && t + GRID_STEP_MINUTES > bs;
        });
        if (occupying) {
          // Clicking a busy slot in this grid needs to open the same detail modal the
          // day-view uses — so the slot carries the full booking, not just a name to
          // display inertly (that was the original gap: clicking a client's name here
          // silently did nothing since there was nothing behind it to open).
          const bookingPayload = applyPhoneReveal({
            _id: occupying._id,
            date: occupying.date,
            startTime: occupying.startTime,
            durationMinutes: occupying.durationMinutes,
            status: occupying.status,
            price: occupying.price,
            source: occupying.source,
            comment: occupying.comment,
            clientName: occupying.clientName,
            clientPhone: occupying.clientPhone,
            readyAt: occupying.readyAt,
            service: occupying.service
              ? { _id: occupying.service._id, name: occupying.service.name, price: occupying.service.price }
              : null,
            staff: { _id: staff._id, name: staff.name },
          });
          slots.push({ time, status: 'busy', clientName: occupying.clientName, booking: bookingPayload });
          continue;
        }
        const fits =
          t + durationMinutes <= winEnd &&
          !overlapsBreak(window, t, t + durationMinutes) &&
          !bookings.some((b) => {
            const bs = timeToMinutes(b.startTime);
            const be = bs + b.durationMinutes;
            return t < be && t + durationMinutes > bs;
          });
        slots.push({ time, status: fits ? 'free' : 'tight' });
      }

      days.push({ date: dateKey, weekday: WEEKDAY_KEYS[dt.getDay()], working: !!window, slots });
    }

    res.json({
      staffId: staff._id,
      staffName: staff.name,
      serviceId,
      durationMinutes,
      gridStartHour: GRID_START_HOUR,
      gridEndHour: GRID_END_HOUR,
      stepMinutes: GRID_STEP_MINUTES,
      weekStart: toDateKeyLocal(monday),
      days,
    });
  })
);

// ---- Service availability across all eligible masters: answer "who's free for X next
// week, anyone" without picking a master first ----

router.get(
  '/services/:serviceId/week-availability',
  asyncHandler(async (req, res) => {
    const service = await Service.findOne({ _id: req.params.serviceId, business: req.businessId }).lean();
    if (!service) return res.status(404).json({ error: 'NOT_FOUND' });

    const eligibleFilter =
      service.staff && service.staff.length ? { _id: { $in: service.staff } } : {};
    // Need the full schedule/timeOff fields (not just name) — getWorkingWindow() reads
    // them directly, and a narrow .select() here silently makes every day look like a
    // day off for every master.
    const staffList = await Staff.find({
      ...eligibleFilter,
      business: req.businessId,
      active: true,
      virtual: { $ne: true },
    }).lean();
    if (staffList.length === 0) return res.status(404).json({ error: 'NO_ELIGIBLE_STAFF' });

    const durationMinutes = service.durationMinutes;
    const fromRaw = typeof req.query.from === 'string' && DATE_RE.test(req.query.from) ? req.query.from : toDateKeyLocal(new Date());
    const monday = mondayOf(fromRaw);
    const staffIds = staffList.map((s) => s._id);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const dt = new Date(monday.getTime());
      dt.setDate(monday.getDate() + i);
      const dateKey = toDateKeyLocal(dt);

      const workingWindows = new Map();
      for (const staff of staffList) {
        const window = getWorkingWindow(staff, dateKey);
        if (window) workingWindows.set(String(staff._id), window);
      }

      const bookings = workingWindows.size
        ? await Booking.find({
            staff: { $in: staffIds },
            date: dateKey,
            status: { $in: ['confirmed', 'completed'] },
          })
            .select('staff startTime durationMinutes')
            .lean()
        : [];

      const slots = [];
      for (let t = GRID_START_HOUR * 60; t < GRID_END_HOUR * 60; t += GRID_STEP_MINUTES) {
        const time = minutesToTime(t);
        let anyWorking = false;
        const freeStaffIds = [];

        for (const staff of staffList) {
          const window = workingWindows.get(String(staff._id));
          if (!window) continue;
          const winStart = timeToMinutes(window.start);
          const winEnd = timeToMinutes(window.end);
          if (t < winStart || t >= winEnd || overlapsBreak(window, t, t + GRID_STEP_MINUTES)) continue;
          anyWorking = true;

          const staffBookings = bookings.filter((b) => String(b.staff) === String(staff._id));
          const fits =
            t + durationMinutes <= winEnd &&
            !overlapsBreak(window, t, t + durationMinutes) &&
            !staffBookings.some((b) => {
              const bs = timeToMinutes(b.startTime);
              const be = bs + b.durationMinutes;
              return t < be && t + durationMinutes > bs;
            });
          if (fits) freeStaffIds.push(String(staff._id));
        }

        slots.push({
          time,
          status: freeStaffIds.length > 0 ? 'free' : anyWorking ? 'busy' : 'off',
          freeStaffIds,
        });
      }

      days.push({ date: dateKey, weekday: WEEKDAY_KEYS[dt.getDay()], slots });
    }

    res.json({
      serviceId: service._id,
      serviceName: service.name,
      durationMinutes,
      staff: staffList.map((s) => ({ _id: s._id, name: s.name })),
      gridStartHour: GRID_START_HOUR,
      gridEndHour: GRID_END_HOUR,
      stepMinutes: GRID_STEP_MINUTES,
      weekStart: toDateKeyLocal(monday),
      days,
    });
  })
);

// ---- Business ledger: configurable monthly P&L with carried-forward recurring costs ----

const METRIC_GROUPS = ['revenue', 'expense', 'info'];
const METRIC_UNITS = ['currency', 'number', 'percent', 'text'];
const METRIC_PERSISTENCE = ['monthly', 'recurring'];
const MONTH_RE = /^\d{4}-\d{2}$/;
const REPORT_PERIOD_MONTHS = { month: 1, quarter: 3, 'half-year': 6, '9-months': 9, year: 12 };

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function addMonths(monthKey, delta) {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

router.get(
  '/metric-definitions',
  asyncHandler(async (req, res) => {
    const includeArchived = req.query.includeArchived === '1';
    const filter = { business: req.businessId };
    if (!includeArchived) filter.archived = { $ne: true };
    const definitions = await BusinessMetricDefinition.find(filter).sort({ order: 1 }).lean();
    res.json({ definitions });
  })
);

router.post(
  '/metric-definitions',
  asyncHandler(async (req, res) => {
    const { label, group, unit, persistence } = req.body || {};
    if (typeof label !== 'string' || !label.trim()) return res.status(400).json({ error: 'INVALID_INPUT' });
    if (!METRIC_GROUPS.includes(group)) return res.status(400).json({ error: 'INVALID_INPUT' });
    if (!METRIC_UNITS.includes(unit)) return res.status(400).json({ error: 'INVALID_INPUT' });
    if (!METRIC_PERSISTENCE.includes(persistence)) return res.status(400).json({ error: 'INVALID_INPUT' });

    const key = generateFieldKey();
    const count = await BusinessMetricDefinition.countDocuments({ business: req.businessId });

    try {
      const definition = await BusinessMetricDefinition.create({
        business: req.businessId,
        key,
        label: label.trim(),
        group,
        unit,
        persistence,
        order: count,
      });
      res.status(201).json({ definition });
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ error: 'FIELD_EXISTS' });
      throw err;
    }
  })
);

router.patch(
  '/metric-definitions/:id',
  asyncHandler(async (req, res) => {
    const update = {};
    if (typeof req.body?.label === 'string' && req.body.label.trim()) update.label = req.body.label.trim();
    if (METRIC_GROUPS.includes(req.body?.group)) update.group = req.body.group;
    if (METRIC_UNITS.includes(req.body?.unit)) update.unit = req.body.unit;
    if (METRIC_PERSISTENCE.includes(req.body?.persistence)) update.persistence = req.body.persistence;
    if (typeof req.body?.order === 'number') update.order = req.body.order;

    const definition = await BusinessMetricDefinition.findOneAndUpdate(
      { _id: req.params.id, business: req.businessId },
      update,
      { new: true }
    );
    if (!definition) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json({ definition });
  })
);

// Soft-delete only — archiving a column stops it from appearing in future data
// entry, but past months that already recorded a value for it keep counting that
// value in their historical totals so reports never silently rewrite history.
router.delete(
  '/metric-definitions/:id',
  asyncHandler(async (req, res) => {
    const definition = await BusinessMetricDefinition.findOneAndUpdate(
      { _id: req.params.id, business: req.businessId },
      { archived: true },
      { new: true }
    );
    if (!definition) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json({ ok: true });
  })
);

router.get(
  '/ledger/:month',
  asyncHandler(async (req, res) => {
    const month = req.params.month;
    if (!MONTH_RE.test(month)) return res.status(400).json({ error: 'INVALID_INPUT' });

    const definitions = await BusinessMetricDefinition.find({ business: req.businessId, archived: { $ne: true } })
      .sort({ order: 1 })
      .lean();

    const current = await computeMonthMetrics(req.businessId, month, definitions);
    const previousMonth = addMonths(month, -1);
    const previous = await computeMonthMetrics(req.businessId, previousMonth, definitions);
    const insights = buildInsights(current, previous);

    res.json({ ...current, previousMonth: previous.month, insights });
  })
);

router.patch(
  '/ledger/:month',
  asyncHandler(async (req, res) => {
    const month = req.params.month;
    if (!MONTH_RE.test(month)) return res.status(400).json({ error: 'INVALID_INPUT' });
    if (!req.body?.values || typeof req.body.values !== 'object') return res.status(400).json({ error: 'INVALID_INPUT' });

    const definitions = await BusinessMetricDefinition.find({ business: req.businessId, archived: { $ne: true } })
      .select('key')
      .lean();
    const validKeys = new Set(definitions.map((d) => d.key));

    const entry = await MonthlyLedgerEntry.findOneAndUpdate(
      { business: req.businessId, month },
      { $setOnInsert: { business: req.businessId, month } },
      { new: true, upsert: true }
    );

    for (const [key, value] of Object.entries(req.body.values)) {
      if (!validKeys.has(key)) continue;
      entry.values.set(key, encryptValue(value));
    }
    await entry.save();

    res.json({ ok: true });
  })
);

router.get(
  '/reports/:period',
  asyncHandler(async (req, res) => {
    const monthsSpan = REPORT_PERIOD_MONTHS[req.params.period];
    if (!monthsSpan) return res.status(400).json({ error: 'INVALID_INPUT' });

    const endMonth = typeof req.query.end === 'string' && MONTH_RE.test(req.query.end) ? req.query.end : currentMonthKey();
    const definitions = await BusinessMetricDefinition.find({ business: req.businessId, archived: { $ne: true } })
      .sort({ order: 1 })
      .lean();

    const months = Array.from({ length: monthsSpan }, (_, i) => addMonths(endMonth, -(monthsSpan - 1) + i));
    const monthsMetrics = [];
    for (const month of months) {
      monthsMetrics.push(await computeMonthMetrics(req.businessId, month, definitions));
    }

    const totals = monthsMetrics.reduce(
      (acc, m) => ({
        grossRevenue: acc.grossRevenue + m.totals.grossRevenue,
        totalExpenses: acc.totalExpenses + m.totals.totalExpenses,
        netProfit: acc.netProfit + m.totals.netProfit,
        bookingsCount: acc.bookingsCount + m.auto.bookingsCount,
        completedCount: acc.completedCount + m.auto.completedCount,
      }),
      { grossRevenue: 0, totalExpenses: 0, netProfit: 0, bookingsCount: 0, completedCount: 0 }
    );
    const marginPercent = totals.grossRevenue > 0 ? Math.round((totals.netProfit / totals.grossRevenue) * 1000) / 10 : 0;
    const averageCheck = totals.completedCount > 0 ? Math.round(totals.grossRevenue / totals.completedCount) : 0;

    res.json({
      period: req.params.period,
      endMonth,
      months: monthsMetrics,
      totals: { ...totals, marginPercent, averageCheck },
      insights: buildPeriodInsights(monthsMetrics),
    });
  })
);

module.exports = router;
