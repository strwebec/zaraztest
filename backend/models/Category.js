const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    nameEn: { type: String, required: true },
    // PENDING = requested by a business at registration/service-creation via "Other",
    // awaiting super-admin approval before it appears as a public filter/selectable option.
    status: { type: String, enum: ['ACTIVE', 'PENDING', 'REJECTED'], default: 'ACTIVE', index: true },
    requestedByBusiness: { type: mongoose.Schema.Types.ObjectId, ref: 'Business' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Category', categorySchema);
