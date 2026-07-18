const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: [
        'booking_confirmed',
        'booking_reminder',
        'booking_cancelled_by_business',
        'review_reply',
        'rating_warning',
        'order_ready',
        'invoice_payment_reminder',
        'support_reply',
      ],
      required: true,
    },
    title: { type: String, required: true },
    text: { type: String, required: true },
    read: { type: Boolean, default: false },
    relatedBooking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);
