const Booking = require('../models/Booking');
const Notification = require('../models/Notification');

// Runs every 5 minutes. A confirmed booking whose scheduled end time has already
// passed, and that the business never manually marked completed/no-show/cancelled,
// is treated as a completed visit — this is what makes "today's revenue", analytics,
// and rating actually reflect what happened instead of silently omitting anything
// the business never got around to clicking a status button for.
async function runAutoCompleteBookings() {
  const now = new Date();
  const nowDateKey = now.toISOString().slice(0, 10);

  const candidates = await Booking.find({ status: 'confirmed', date: { $lte: nowDateKey } })
    .populate('business', 'name')
    .populate('service', 'name');

  let completedCount = 0;
  for (const booking of candidates) {
    const end = new Date(`${booking.date}T${booking.startTime}:00`);
    end.setMinutes(end.getMinutes() + booking.durationMinutes);
    if (end > now) continue;

    booking.status = 'completed';
    // eslint-disable-next-line no-await-in-loop
    await booking.save();
    completedCount += 1;

    if (booking.client) {
      // eslint-disable-next-line no-await-in-loop
      await Notification.create({
        user: booking.client,
        type: 'booking_completed',
        title: 'Як пройшов візит?',
        text: `Залиште відгук про ${booking.business?.name ?? 'заклад'} — ${booking.service?.name ?? 'послугу'}. Це допоможе іншим клієнтам.`,
        relatedBooking: booking._id,
      });
    }
  }

  if (completedCount) console.log(`[autoCompleteBookings] auto-completed ${completedCount} bookings`);
}

module.exports = { runAutoCompleteBookings };
