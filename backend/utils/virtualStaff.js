const Staff = require('../models/Staff');

const VIRTUAL_STAFF_NAME = 'Без майстра';

// A business that hasn't added any staff yet still needs a schedule to book against.
// This gets (or lazily creates) one hidden Staff document per business, whose schedule
// mirrors business.workingHours at creation time, so the existing per-staff
// availability/booking machinery works unmodified with zero special-casing. Kept in
// sync going forward by routes/business.js's working-hours update handler, not here,
// so this stays a cheap read on the (much hotter) catalog/booking paths.
async function getOrCreateVirtualStaff(business) {
  const existing = await Staff.findOne({ business: business._id, virtual: true });
  if (existing) return existing;
  return Staff.create({
    business: business._id,
    name: VIRTUAL_STAFF_NAME,
    schedule: business.workingHours,
    active: true,
    virtual: true,
  });
}

module.exports = { getOrCreateVirtualStaff, VIRTUAL_STAFF_NAME };
