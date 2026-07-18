const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema(
  {
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: String,
    price: { type: Number, required: true },
    durationMinutes: { type: Number, required: true },
    category: { type: String, required: true },
    photoUrl: String,
    staff: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Staff' }],
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Service', serviceSchema);
