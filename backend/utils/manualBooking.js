const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const { slotUnavailableReason, reasonToErrorCode } = require('./availability');
const { resolveCommissionRate } = require('./commission');

// Shared by the business-dashboard "add booking" endpoint and the Google Sheets
// offline-fallback import job, so both go through the same transaction + slot-lock
// guarantee instead of two divergent copies of this logic.
async function createManualBooking({
  businessId,
  businessCreatedAt,
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
  bufferMinutes,
}) {
  const effectiveDuration = durationMinutes ?? service.durationMinutes;
  const effectivePrice = price ?? service.price;
  const session = await mongoose.startSession();
  try {
    let booking;
    await session.withTransaction(async () => {
      const reason = await slotUnavailableReason({
        staff,
        date,
        startTime,
        durationMinutes: effectiveDuration,
        session,
        bufferMinutes,
      });
      if (reason) {
        const code = reasonToErrorCode(reason);
        const err = new Error(code);
        err.code = code;
        throw err;
      }

      const created = await Booking.create(
        [
          {
            clientName: clientName.trim(),
            clientPhone,
            business: businessId,
            service: service._id,
            staff: staff._id,
            date,
            startTime,
            durationMinutes: effectiveDuration,
            price: effectivePrice,
            isFree: !!service.isFree,
            quantity: quantity ?? 1,
            autoAssignedStaff: !!autoAssignedStaff,
            source: 'manual',
            status: 'confirmed',
            comment,
            commissionRate: resolveCommissionRate(businessCreatedAt, Number(process.env.COMMISSION_MANUAL) || 0.01),
          },
        ],
        { session }
      );
      booking = created[0];
    });
    return booking;
  } finally {
    await session.endSession();
  }
}

module.exports = { createManualBooking };
