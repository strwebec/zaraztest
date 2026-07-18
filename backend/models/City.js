const mongoose = require('mongoose');

const citySchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    nameEn: { type: String, trim: true },
    active: { type: Boolean, default: true },
    lat: Number,
    lng: Number,
  },
  { timestamps: true }
);

module.exports = mongoose.model('City', citySchema);
