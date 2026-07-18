const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    text: { type: String, required: true },
    status: { type: String, enum: ['PUBLISHED', 'PENDING', 'REJECTED'], default: 'PUBLISHED', index: true },
    reply: {
      text: String,
      repliedAt: Date,
    },
    replyFlagged: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Review', reviewSchema);
