const FREE_COMMISSION_MONTHS = 6;

/** True while a business is still inside its free-commission introductory period. */
function isWithinFreeCommissionPeriod(businessCreatedAt) {
  if (!businessCreatedAt) return false;
  const freeUntil = new Date(businessCreatedAt);
  freeUntil.setMonth(freeUntil.getMonth() + FREE_COMMISSION_MONTHS);
  return Date.now() < freeUntil.getTime();
}

/** 0% for a business's first 6 months, the standard rate afterwards. */
function resolveCommissionRate(businessCreatedAt, standardRate) {
  return isWithinFreeCommissionPeriod(businessCreatedAt) ? 0 : standardRate;
}

module.exports = { FREE_COMMISSION_MONTHS, isWithinFreeCommissionPeriod, resolveCommissionRate };
