const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    clientName: String,
    clientPhone: String,
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
    staff: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', required: true, index: true },

    date: { type: String, required: true }, // YYYY-MM-DD
    startTime: { type: String, required: true }, // HH:mm
    durationMinutes: { type: Number, required: true },
    price: { type: Number, required: true }, // snapshot of service price at booking time
    isFree: { type: Boolean, default: false }, // snapshot of service.isFree at booking time

    source: { type: String, enum: ['platform', 'manual'], default: 'platform' },
    status: {
      type: String,
      enum: ['confirmed', 'completed', 'cancelled_by_client', 'cancelled_by_business', 'no_show'],
      default: 'confirmed',
      index: true,
    },
    comment: String,
    commissionRate: Number,
    commissionCharged: { type: Boolean, default: true },
    readyAt: Date,

    // Links sibling bookings created together in one multi-service checkout (e.g.
    // manicure + brows back-to-back with the same master) so the UI can present them
    // as a single visit. Each sibling is otherwise a fully independent Booking — its
    // own price/duration/status — and can be cancelled or rescheduled on its own.
    groupId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },

    // Set when a business cancels a booking, to ask the client "was this at your request?"
    cancellationConfirmation: {
      askedAt: Date,
      respondedAt: Date,
      response: { type: String, enum: ['yes', 'no'] },
      processed: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

bookingSchema.index({ staff: 1, date: 1 });
bookingSchema.index({ client: 1, date: 1 });

// Real double-booking protection: a MongoDB transaction only serializes writes that touch
// the SAME document, so two concurrent requests each inserting their own new Booking document
// for the same slot pass the in-transaction "is this slot free?" read check and both commit —
// the transaction never sees a conflict because no document was shared between them. This
// unique index is the actual guarantee: at most one 'confirmed' booking can exist per
// (staff, date, startTime), so the second insert of a race fails at the database with a
// duplicate-key error, which route handlers translate to 409 SLOT_TAKEN.
bookingSchema.index(
  { staff: 1, date: 1, startTime: 1 },
  { unique: true, partialFilterExpression: { status: 'confirmed' } }
);

module.exports = mongoose.model('Booking', bookingSchema);
