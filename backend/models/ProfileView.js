const mongoose = require('mongoose');

const profileViewSchema = new mongoose.Schema({
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
  // SHA-256 of the viewer's IP — never store raw IPs, only enough to de-duplicate repeat views.
  ipHash: { type: String, required: true },
  viewedAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 30 }, // TTL: 30 days
});

profileViewSchema.index({ business: 1, ipHash: 1, viewedAt: -1 });

module.exports = mongoose.model('ProfileView', profileViewSchema);
