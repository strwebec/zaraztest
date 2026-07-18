const mongoose = require('mongoose');

// Visit stats (visitsCount, totalSpent, lastVisitAt) are deliberately NOT stored
// here — they're derived live from Booking by clientPhone, which can never drift
// out of sync with the actual booking history. This document only holds the
// business-authored data that has no other home: notes and custom field values,
// created lazily the first time a business edits a client's record.
const businessClientSchema = new mongoose.Schema(
  {
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    phone: { type: String, required: true }, // normalized, matches Booking.clientPhone within this business
    notes: { type: String, default: '' },
    customFieldValues: { type: Map, of: mongoose.Schema.Types.Mixed, default: undefined },
  },
  { timestamps: true }
);

businessClientSchema.index({ business: 1, phone: 1 }, { unique: true });

module.exports = mongoose.model('BusinessClient', businessClientSchema);
