const PHONE_REVEAL_HOURS = 3;

function maskPhone(phone) {
  if (!phone || typeof phone !== 'string') return phone;
  const trimmed = phone.trim();
  if (trimmed.length <= 6) return '•'.repeat(trimmed.length);
  const head = trimmed.slice(0, 4);
  const tail = trimmed.slice(-2);
  const middle = '•'.repeat(Math.max(trimmed.length - head.length - tail.length, 3));
  return `${head}${middle}${tail}`;
}

function applyPhoneReveal(bookingObj) {
  if (!bookingObj) return bookingObj;
  if (bookingObj.source === 'manual' || !bookingObj.clientPhone) {
    return { ...bookingObj, phoneRevealed: true };
  }

  const appointmentAt = new Date(`${bookingObj.date}T${bookingObj.startTime}:00`);
  const revealAt = new Date(appointmentAt.getTime() - PHONE_REVEAL_HOURS * 60 * 60 * 1000);
  const revealed = Date.now() >= revealAt.getTime();

  return {
    ...bookingObj,
    clientPhone: revealed ? bookingObj.clientPhone : maskPhone(bookingObj.clientPhone),
    phoneRevealed: revealed,
    phoneRevealAt: revealAt.toISOString(),
  };
}

module.exports = { PHONE_REVEAL_HOURS, maskPhone, applyPhoneReveal };
