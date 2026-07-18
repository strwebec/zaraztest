const Booking = require('../models/Booking');
const Expense = require('../models/Expense');
const MonthlyLedgerEntry = require('../models/MonthlyLedgerEntry');
const { decryptValue } = require('./ledgerCrypto');

function monthBounds(month) {
  const [year, mon] = month.split('-').map(Number);
  const lastDay = new Date(year, mon, 0).getDate();
  return { first: `${month}-01`, last: `${month}-${String(lastDay).padStart(2, '0')}` };
}

function readMapValue(values, key) {
  if (!values) return undefined;
  return values instanceof Map ? values.get(key) : values[key];
}

// "Recurring" fields (rent, fixed salaries) only need to be entered once — for any
// month that has no explicit value, we carry forward the most recent prior entry
// instead of silently treating it as zero. "Monthly" fields reset every month by
// design (one-off costs shouldn't leak into a month they didn't happen in).
async function getEffectiveValues(businessId, month, definitions) {
  const recurringKeys = definitions.filter((d) => d.persistence === 'recurring').map((d) => d.key);
  const needsHistory = recurringKeys.length > 0;

  const entries = needsHistory
    ? await MonthlyLedgerEntry.find({ business: businessId, month: { $lte: month } })
        .sort({ month: -1 })
        .lean()
    : await MonthlyLedgerEntry.find({ business: businessId, month }).lean();

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

async function computeMonthMetrics(businessId, month, definitions) {
  const { first, last } = monthBounds(month);

  const bookings = await Booking.find({ business: businessId, date: { $gte: first, $lte: last } })
    .select('status price commissionRate')
    .lean();

  let autoRevenue = 0;
  let autoCommission = 0;
  let completedCount = 0;
  let cancelledCount = 0;
  let noShowCount = 0;
  for (const b of bookings) {
    if (b.status === 'completed') {
      autoRevenue += b.price;
      autoCommission += b.price * (b.commissionRate ?? 0);
      completedCount += 1;
    } else if (b.status.startsWith('cancelled')) {
      cancelledCount += 1;
    } else if (b.status === 'no_show') {
      noShowCount += 1;
    }
  }
  const totalBookings = bookings.length;
  const averageCheck = completedCount > 0 ? autoRevenue / completedCount : 0;
  const cancellationRatePercent = totalBookings > 0 ? ((cancelledCount + noShowCount) / totalBookings) * 100 : 0;

  const expenses = await Expense.find({ business: businessId, date: { $gte: first, $lte: last } }).lean();
  const autoExpenseTotal = expenses.reduce((sum, e) => sum + e.amount, 0);
  const expenseByCategory = new Map();
  for (const e of expenses) expenseByCategory.set(e.category, (expenseByCategory.get(e.category) ?? 0) + e.amount);
  const topExpenseEntry = [...expenseByCategory.entries()].sort((a, b) => b[1] - a[1])[0];

  const effectiveValues = await getEffectiveValues(businessId, month, definitions);
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
  const totalExpenses = autoCommission + autoExpenseTotal + manualExpense;
  const netProfit = grossRevenue - totalExpenses;
  const marginPercent = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;

  return {
    month,
    auto: {
      revenue: Math.round(autoRevenue),
      commission: Math.round(autoCommission),
      expenseTotal: Math.round(autoExpenseTotal),
      topExpenseCategory: topExpenseEntry ? { category: topExpenseEntry[0], amount: Math.round(topExpenseEntry[1]) } : null,
      bookingsCount: totalBookings,
      completedCount,
      cancelledCount,
      noShowCount,
      averageCheck: Math.round(averageCheck),
      cancellationRatePercent: Math.round(cancellationRatePercent * 10) / 10,
    },
    manualFields,
    totals: {
      grossRevenue: Math.round(grossRevenue),
      totalExpenses: Math.round(totalExpenses),
      netProfit: Math.round(netProfit),
      marginPercent: Math.round(marginPercent * 10) / 10,
    },
  };
}

module.exports = { computeMonthMetrics, monthBounds };
