const Business = require('../models/Business');
const Service = require('../models/Service');
const Staff = require('../models/Staff');
const Booking = require('../models/Booking');
const User = require('../models/User');
const { createManualBooking } = require('../utils/manualBooking');
const { isConfigured, createBusinessSheet, readSheetRows, writeSheetRows } = require('../utils/googleSheets');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function toDateKey(d) {
  return d.toISOString().slice(0, 10);
}

// Imports rows a business typed directly into the sheet while offline (blank ID
// column) into real Booking documents, going through the same slot-lock guarantee
// as the in-app "add booking" form. Rows that fail get an error note written back
// instead of being silently retried forever on the next sync.
async function importManualRows(business, rows, services, staffList) {
  for (const row of rows) {
    const [id, date, startTime, clientName, clientPhone, serviceName, staffName, , status] = row;
    if (id || status) continue; // already imported, or already flagged with an error
    if (!date || !startTime || !clientName || !serviceName) continue;
    if (!DATE_RE.test(date) || !TIME_RE.test(startTime)) {
      row[8] = 'ПОМИЛКА: невірний формат дати чи часу (РРРР-ММ-ДД, ГГ:ХХ)';
      continue;
    }

    const service = services.find((s) => s.name.trim().toLowerCase() === serviceName.trim().toLowerCase());
    if (!service) {
      row[8] = `ПОМИЛКА: послугу «${serviceName}» не знайдено`;
      continue;
    }
    const staff = staffName
      ? staffList.find((s) => s.name.trim().toLowerCase() === staffName.trim().toLowerCase())
      : staffList[0];
    if (!staff) {
      row[8] = `ПОМИЛКА: майстра «${staffName || ''}» не знайдено`;
      continue;
    }

    try {
      const booking = await createManualBooking({
        businessId: business._id,
        businessCreatedAt: business.createdAt,
        service,
        staff,
        date,
        startTime,
        clientName,
        clientPhone: clientPhone || undefined,
      });
      row[0] = String(booking._id);
      row[8] = 'confirmed';
    } catch (err) {
      row[8] = err.code === 'SLOT_TAKEN' ? 'ПОМИЛКА: цей час вже зайнято' : 'ПОМИЛКА: не вдалося створити запис';
    }
  }
}

async function syncOneBusiness(business) {
  const owner = await User.findById(business.owner).lean();
  if (!owner) return;

  if (!business.backupSheetId) {
    const { spreadsheetId, spreadsheetUrl } = await createBusinessSheet(business, owner.email);
    business.backupSheetId = spreadsheetId;
    business.backupSheetUrl = spreadsheetUrl;
    await business.save();
  }

  const [services, staffList] = await Promise.all([
    Service.find({ business: business._id, active: true }).lean(),
    Staff.find({ business: business._id, active: true, virtual: { $ne: true } }).lean(),
  ]);

  const existingRows = await readSheetRows(business.backupSheetId);
  await importManualRows(business, existingRows, services, staffList);

  const today = new Date();
  const from = toDateKey(today);
  const to = toDateKey(new Date(today.getTime() + 21 * 24 * 60 * 60 * 1000));

  const bookings = await Booking.find({
    business: business._id,
    date: { $gte: from, $lte: to },
    status: { $ne: 'cancelled_by_client' },
  })
    .populate('service', 'name')
    .populate('staff', 'name')
    .sort({ date: 1, startTime: 1 })
    .lean();

  const rows = bookings.map((b) => [
    String(b._id),
    b.date,
    b.startTime,
    b.clientName,
    b.clientPhone || '',
    b.service?.name || '',
    b.staff?.name || '',
    b.price,
    b.status,
    b.source,
  ]);

  // Rows that failed to import (bad slot, unknown service/staff name, etc.) have no
  // Booking document, so they wouldn't appear in the DB-sourced rows above — keep
  // them visible with their error note so the business can fix and retry them.
  const unresolvedRows = existingRows.filter((row) => !row[0] && typeof row[8] === 'string' && row[8].startsWith('ПОМИЛКА'));

  await writeSheetRows(business.backupSheetId, [...rows, ...unresolvedRows]);
}

async function runSheetsSync() {
  if (!isConfigured()) return;

  const businesses = await Business.find({ status: { $in: ['ACTIVE', 'HIDDEN'] } });
  let synced = 0;
  for (const business of businesses) {
    try {
      await syncOneBusiness(business);
      synced += 1;
    } catch (err) {
      console.error(`[sheetsSync] failed for business ${business._id}`, err.message);
    }
  }
  console.log(`[sheetsSync] synced ${synced}/${businesses.length} businesses`);
}

module.exports = { runSheetsSync };
