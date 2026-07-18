const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema(
  {
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: String,
    price: { type: Number, required: true },
    // When true, price is forced to 0 server-side regardless of what was submitted —
    // see routes/business.js's service create/update handlers.
    isFree: { type: Boolean, default: false },
    durationMinutes: { type: Number, required: true },
    category: { type: String, required: true },
    photoUrl: String,
    staff: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Staff' }],
    // When false, this service must be booked alone — it can't be added to a
    // multi-service checkout alongside other services. Defaults to true (today's
    // behavior) so existing services stay combinable without any migration.
    combinable: { type: Boolean, default: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Service', serviceSchema);
