const Invoice = require('../models/Invoice');
const TopPlacement = require('../models/TopPlacement');
const Booking = require('../models/Booking');
const MonthlyPlatformLedgerEntry = require('../models/MonthlyPlatformLedgerEntry');
const { decryptValue } = require('./ledgerCrypto');

// Invoice.paidAt / TopPlacement.confirmedAt are real Date objects (unlike Booking's
// string `date`), so month bounds here need real calendar-boundary Dates, interpreted
// in server-local time like the rest of the codebase (no UTC 'Z' suffix anywhere).
function monthDateBounds(month) {
  const [year, mon] = month.split('-').map(Number);
  const start = new Date(year, mon - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, mon, 0, 23, 59, 59, 999);
  return { start, end };
}

// Booking.date is stored as a 'YYYY-MM-DD' string, so it still needs the
// string-bounds comparison ledgerCalc.js uses for the business ledger.
function monthStringBounds(month) {
  const [year, mon] = month.split('-').map(Number);
  const lastDay = new Date(year, mon, 0).getDate();
  return { first: `${month}-01`, last: `${month}-${String(lastDay).padStart(2, '0')}` };
}

function readMapValue(values, key) {
  if (!values) return undefined;
  return values instanceof Map ? values.get(key) : values[key];
}

async function getEffectiveValues(month, definitions) {
  const recurringKeys = definitions.filter((d) => d.persistence === 'recurring').map((d) => d.key);
  const needsHistory = recurringKeys.length > 0;

  const entries = needsHistory
    ? await MonthlyPlatformLedgerEntry.find({ month: { $lte: month } }).sort({ month: -1 }).lean()
    : await MonthlyPlatformLedgerEntry.find({ month }).lean();

  const currentEntry = entries.find((e) => e.month === month);
  const result = {};

  for (const def of definitions) {
    if (def.persistence === 'recurring') {
      let found;
      for (const entry of entries) {
        const raw = readMapValue(entry.values, def.key);
        if (raw !== undefined) {
          found = raw;
          break;
        }
      }
      result[def.key] = found !== undefined ? decryptValue(found) : null;
    } else {
      const raw = readMapValue(currentEntry?.values, def.key);
      result[def.key] = raw !== undefined ? decryptValue(raw) : null;
    }
  }
  return result;
}

// Gross platform revenue driving the net payout is CASH-basis (money actually
// collected) — matching admin.js's /finance/overview convention — not the
// accrual-basis figure /analytics uses (commission earned on completed bookings
// regardless of invoicing). Accrued commission is still surfaced, but only as an
// informational comparison, never counted into netPayout: showing a bank-account
// payout number derived from money not yet in hand would be actively misleading.
async function computeMonthMetrics(month, definitions) {
  const { start, end } = monthDateBounds(month);
  const { first, last } = monthStringBounds(month);

  const [commissionAgg, topPlacementAgg, accruedAgg] = await Promise.all([
    Invoice.aggregate([
      { $match: { status: 'PAID', paidAt: { $gte: start, $lte: end } } },
      { $group: { _id: null, total: { $sum: '$totalCommission' }, count: { $sum: 1 } } },
    ]),
    TopPlacement.aggregate([
      { $match: { status: 'CONFIRMED', confirmedAt: { $gte: start, $lte: end } } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Booking.aggregate([
      { $match: { status: 'completed', date: { $gte: first, $lte: last } } },
      { $group: { _id: null, total: { $sum: { $multiply: ['$price', { $ifNull: ['$commissionRate', 0] }] } } } },
    ]),
  ]);

  const collectedCommission = Math.round(commissionAgg[0]?.total ?? 0);
  const collectedTopPlacements = Math.round(topPlacementAgg[0]?.total ?? 0);
  const invoicesPaidCount = commissionAgg[0]?.count ?? 0;
  const topPlacementsPaidCount = topPlacementAgg[0]?.count ?? 0;
  const accruedCommission = Math.round(accruedAgg[0]?.total ?? 0);
  const autoRevenue = collectedCommission + collectedTopPlacements;

  const effectiveValues = await getEffectiveValues(month, definitions);
  let manualRevenue = 0;
  let manualExpense = 0;
  const manualFields = definitions.map((def) => {
    const raw = effectiveValues[def.key];
    if (def.unit === 'text') {
      return { key: def.key, label: def.label, group: def.group, unit: def.unit, persistence: def.persistence, value: raw ?? '' };
    }
    const numeric = Number(raw);
    const value = Number.isFinite(numeric) ? numeric : 0;
    if (def.group === 'revenue') manualRevenue += value;
    if (def.group === 'expense') manualExpense += value;
    return { key: def.key, label: def.label, group: def.group, unit: def.unit, persistence: def.persistence, value };
  });

  const grossRevenue = autoRevenue + manualRevenue;
  const totalExpenses = manualExpense;
  const netPayout = grossRevenue - totalExpenses;
  const marginPercent = grossRevenue > 0 ? (netPayout / grossRevenue) * 100 : 0;

  return {
    month,
    auto: {
      revenue: autoRevenue,
      collectedCommission,
      collectedTopPlacements,
      accruedCommission,
      invoicesPaidCount,
      topPlacementsPaidCount,
    },
    manualFields,
    totals: {
      grossRevenue: Math.round(grossRevenue),
      totalExpenses: Math.round(totalExpenses),
      netPayout: Math.round(netPayout),
      marginPercent: Math.round(marginPercent * 10) / 10,
    },
  };
}

module.exports = { computeMonthMetrics, monthDateBounds, monthStringBounds };
