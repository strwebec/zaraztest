// Must build the YYYY-MM-DD string from local date parts, not toISOString()
// (which converts to UTC first) — in a positive-UTC-offset timezone that shifts
// the date back by one, e.g. local midnight July 6 becomes "2026-07-05" in UTC.
function toKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Returns {from, to} date-string bounds (Mon-Sun) for the week containing dateStr. */
function getWeekRange(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = d.getDay(); // 0 = Sunday
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { from: toKey(monday), to: toKey(sunday) };
}

module.exports = { getWeekRange };
