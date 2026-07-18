const mongoose = require('mongoose');

const PACKAGES = {
  '1week': { days: 7, price: 300 },
  '2weeks': { days: 14, price: 500 },
  '1month': { days: 30, price: 700 },
};

const topPlacementSchema = new mongoose.Schema(
  {
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    package: { type: String, enum: Object.keys(PACKAGES), required: true },
    amount: { type: Number, required: true },
    durationDays: { type: Number, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'AWAITING_ACTIVATION', 'CONFIRMED', 'REJECTED'],
      default: 'PENDING',
      index: true,
    },
    requestedAt: { type: Date, default: Date.now },
    receiptUrl: String,
    paymentConfirmedAt: Date,
    activateAt: Date,
    confirmedAt: Date,
    expiresAt: Date,
    rejectionReason: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('TopPlacement', topPlacementSchema);
module.exports.PACKAGES = PACKAGES;
