const Booking = require('../models/Booking');

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DEFAULT_SLOT_STEP_MINUTES = 30;

function timeToMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(mins) {
  const h = Math.floor(mins / 60)
    .toString()
    .padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function dayKeyForDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return WEEKDAY_KEYS[d.getDay()];
}

/**
 * A service can never be booked if it doesn't fit inside at least one working day —
 * so the cap is the longest single non-day-off day in the week, not an average or a
 * sum. A lunch break splits a day into two segments a service can't span, so the cap
 * for that day is the longer of the two, not the full open-to-close span. Returns 0
 * if every day is marked off (nothing to cap against).
 */
function maxWorkingDayMinutes(schedule) {
  if (!schedule) return 0;
  let max = 0;
  for (const key of ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']) {
    const day = schedule[key];
    if (!day || day.dayOff || !day.start || !day.end) continue;
    const dayStart = timeToMinutes(day.start);
    const dayEnd = timeToMinutes(day.end);
    if (day.breakStart && day.breakEnd) {
      const breakStart = timeToMinutes(day.breakStart);
      const breakEnd = timeToMinutes(day.breakEnd);
      max = Math.max(max, breakStart - dayStart, dayEnd - breakEnd);
    } else {
      max = Math.max(max, dayEnd - dayStart);
    }
  }
  return max;
}

/** Returns the working window for a staff member on a given date, or null if day off / not scheduled. */
function getWorkingWindow(staff, dateStr) {
  const key = dayKeyForDate(dateStr);
  const daySchedule = staff.schedule?.get ? staff.schedule.get(key) : staff.schedule?.[key];
  if (!daySchedule || daySchedule.dayOff || !daySchedule.start || !daySchedule.end) return null;

  const onTimeOff = (staff.timeOff || []).some((off) => {
    const from = new Date(off.from);
    const to = new Date(off.to);
    const d = new Date(`${dateStr}T00:00:00`);
    return d >= from && d <= to;
  });
  if (onTimeOff) return null;

  const window = { start: daySchedule.start, end: daySchedule.end };
  if (daySchedule.breakStart && daySchedule.breakEnd) {
    window.breakStart = daySchedule.breakStart;
    window.breakEnd = daySchedule.breakEnd;
  }
  return window;
}

/** Whether [startMin, endMin) overlaps a working window's lunch break, if it has one. */
function overlapsBreak(window, startMin, endMin) {
  if (!window.breakStart || !window.breakEnd) return false;
  const breakStart = timeToMinutes(window.breakStart);
  const breakEnd = timeToMinutes(window.breakEnd);
  return startMin < breakEnd && endMin > breakStart;
}

/**
 * Computes free slots for a staff member on a given date for a service of durationMinutes.
 * A slot at time T is free if [T, T+duration) does not overlap any existing confirmed booking
 * for that staff on that date, and does not overlap the day's lunch break, if any.
 */
async function computeFreeSlots({ staff, date, durationMinutes, stepMinutes = DEFAULT_SLOT_STEP_MINUTES }) {
  const window = getWorkingWindow(staff, date);
  if (!window) return [];

  const startMin = timeToMinutes(window.start);
  const endMin = timeToMinutes(window.end);

  const existing = await Booking.find({
    staff: staff._id,
    date,
    status: { $in: ['confirmed', 'completed'] },
  }).lean();

  const busyRanges = existing.map((b) => {
    const s = timeToMinutes(b.startTime);
    return [s, s + b.durationMinutes];
  });

  const slots = [];
  for (let t = startMin; t + durationMinutes <= endMin; t += stepMinutes) {
    if (overlapsBreak(window, t, t + durationMinutes)) continue;
    const overlaps = busyRanges.some(([bs, be]) => t < be && t + durationMinutes > bs);
    if (!overlaps) slots.push(minutesToTime(t));
  }
  return slots;
}

/**
 * Like isSlotFree, but distinguishes *why* a slot can't be booked — outside the
 * staff's working hours (or a day off), during the lunch break, vs an actual
 * overlapping booking — so callers can return a precise error instead of a blanket
 * "slot taken" for a case that has nothing to do with another booking.
 */
async function slotUnavailableReason({ staff, date, startTime, durationMinutes, session, excludeBookingId }) {
  const window = getWorkingWindow(staff, date);
  if (!window) return 'OUTSIDE_HOURS';

  const slotStart = timeToMinutes(startTime);
  const slotEnd = slotStart + durationMinutes;
  if (slotStart < timeToMinutes(window.start) || slotEnd > timeToMinutes(window.end)) return 'OUTSIDE_HOURS';
  if (overlapsBreak(window, slotStart, slotEnd)) return 'ON_BREAK';

  const filter = {
    staff: staff._id,
    date,
    status: { $in: ['confirmed', 'completed'] },
  };
  if (excludeBookingId) filter._id = { $ne: excludeBookingId };

  const existing = await Booking.find(filter)
    .session(session || null)
    .lean();

  const overlaps = existing.some((b) => {
    const bs = timeToMinutes(b.startTime);
    const be = bs + b.durationMinutes;
    return slotStart < be && slotEnd > bs;
  });
  return overlaps ? 'TAKEN' : null;
}

/**
 * Checks whether [startTime, startTime+duration) is within working hours and free of
 * overlapping bookings for a staff member on a date. Pass `session` to read within a
 * MongoDB transaction so the check and the later insert are atomic against races.
 */
async function isSlotFree(args) {
  return (await slotUnavailableReason(args)) === null;
}

const REASON_ERROR_CODES = { OUTSIDE_HOURS: 'OUTSIDE_WORKING_HOURS', ON_BREAK: 'ON_BREAK', TAKEN: 'SLOT_TAKEN' };

/** Maps a slotUnavailableReason() result to the HTTP-facing error code callers should return. */
function reasonToErrorCode(reason) {
  return REASON_ERROR_CODES[reason] || 'SLOT_TAKEN';
}

/**
 * A client can only be in one place at a time, so unlike slotUnavailableReason (which
 * only checks the one staff member's schedule), this checks ALL of a client's own
 * confirmed/completed bookings on the date — at any business, with any staff — for a
 * time overlap. Returns the conflicting booking (lean doc) or null.
 */
async function findClientConflict({ clientId, date, startTime, durationMinutes, session, excludeBookingId }) {
  const slotStart = timeToMinutes(startTime);
  const slotEnd = slotStart + durationMinutes;

  const filter = {
    client: clientId,
    date,
    status: { $in: ['confirmed', 'completed'] },
  };
  if (excludeBookingId) filter._id = { $ne: excludeBookingId };

  const existing = await Booking.find(filter)
    .session(session || null)
    .lean();

  return (
    existing.find((b) => {
      const bs = timeToMinutes(b.startTime);
      const be = bs + b.durationMinutes;
      return slotStart < be && slotEnd > bs;
    }) || null
  );
}

module.exports = {
  computeFreeSlots,
  isSlotFree,
  slotUnavailableReason,
  reasonToErrorCode,
  findClientConflict,
  getWorkingWindow,
  overlapsBreak,
  timeToMinutes,
  minutesToTime,
  dayKeyForDate,
  maxWorkingDayMinutes,
};
