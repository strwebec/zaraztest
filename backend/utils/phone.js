// Strips everything but digits so "+380 99 123 45 67", "0991234567" and
// "099-123-45-67" all resolve to the same client record — clients get typed
// in inconsistently across manual bookings and platform accounts, and this
// is the one place that inconsistency gets normalized away.
function normalizePhone(phone) {
  return typeof phone === 'string' ? phone.replace(/\D/g, '') : '';
}

module.exports = { normalizePhone };
