const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    text: { type: String, default: '' },
    status: { type: String, enum: ['PUBLISHED', 'PENDING', 'REJECTED'], default: 'PUBLISHED', index: true },
    reply: {
      text: String,
      repliedAt: Date,
    },
    replyFlagged: { type: Boolean, default: false },

    // A business-initiated challenge to an unfair review. While OPEN, the review is
    // excluded from public listings and from the business's rating/popularity score
    // (see utils/reviewStats.js and jobs/dailyRatingUpdate.js) — it reappears (or is
    // permanently hidden) once a super-admin resolves it.
    dispute: {
      status: { type: String, enum: ['OPEN', 'UPHELD', 'DISMISSED'] },
      reason: String,
      openedAt: Date,
      clientResponse: String,
      clientRespondedAt: Date,
      resolution: String,
      resolvedAt: Date,
      resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Review', reviewSchema);
