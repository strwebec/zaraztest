const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: [
        'booking_confirmed',
        'booking_reminder',
        'new_booking_received',
        'booking_cancelled_by_business',
        'booking_cancelled_by_client',
        'booking_rescheduled',
        'booking_completed',
        'review_reply',
        'rating_warning',
        'order_ready',
        'invoice_payment_reminder',
        'support_reply',
        'review_disputed',
        'review_dispute_response',
        'review_dispute_resolved',
        'unfair_cancellation_notice',
      ],
      required: true,
    },
    title: { type: String, required: true },
    text: { type: String, required: true },
    read: { type: Boolean, default: false },
    relatedBooking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    relatedReview: { type: mongoose.Schema.Types.ObjectId, ref: 'Review' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);
