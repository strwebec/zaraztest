const Business = require('../models/Business');
const Booking = require('../models/Booking');
const Invoice = require('../models/Invoice');
const { sendMail } = require('../utils/mailer');

function previousMonthRange() {
  const now = new Date();
  const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const month = firstOfPrevMonth.toISOString().slice(0, 7);
  const from = firstOfPrevMonth.toISOString().slice(0, 10);
  const to = new Date(firstOfThisMonth.getTime() - 1).toISOString().slice(0, 10);
  return { month, from, to };
}

async function generateInvoiceForBusiness(business, { month, from, to }) {
  // Scoped to type: 'COMMISSION' — a manually-created invoice (routes/admin.js POST
  // /invoices) for this same business/month must never block the automatic one.
  const existing = await Invoice.findOne({ business: business._id, month, type: 'COMMISSION' });
  if (existing) return null;

  const bookings = await Booking.find({
    business: business._id,
    date: { $gte: from, $lte: to },
    status: 'completed',
    commissionCharged: true,
  })
    .populate('service', 'name')
    .lean();

  if (bookings.length === 0) return null;

  const items = bookings.map((b) => {
    const commissionAmount = Math.round(b.price * (b.commissionRate ?? 0) * 100) / 100;
    return {
      booking: b._id,
      date: b.date,
      clientName: b.clientName,
      serviceName: b.service?.name,
      price: b.price,
      source: b.source,
      commissionRate: b.commissionRate,
      commissionAmount,
    };
  });

  const totalCommission = Math.round(items.reduce((sum, i) => sum + i.commissionAmount, 0) * 100) / 100;
  const issuedAt = new Date();
  const dueAt = new Date(issuedAt.getTime() + 7 * 24 * 60 * 60 * 1000);

  const invoice = await Invoice.create({
    business: business._id,
    month,
    items,
    totalCommission,
    status: 'PENDING',
    issuedAt,
    dueAt,
  });

  const owner = await require('../models/User').findById(business.owner).lean();
  if (owner) {
    await sendMail({
      to: owner.email,
      subject: `Рахунок за ${month} — ZARAZ`,
      html: `Ваш рахунок комісії за ${month}: ${totalCommission}₴. Оплатіть протягом 7 днів у кабінеті бізнесу.`,
    });
  }

  return invoice;
}

// Invoices normally go out on the 1st. If the 1st falls on a Sunday, generation
// shifts to Monday the 2nd instead, so no invoice silently issues on a non-business day.
function isInvoiceGenerationDay(date = new Date()) {
  const day = date.getDate();
  if (day === 1) return date.getDay() !== 0;
  if (day === 2) {
    const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    return firstOfMonth.getDay() === 0;
  }
  return false;
}

async function runMonthlyInvoices() {
  const range = previousMonthRange();
  const businesses = await Business.find({ status: { $in: ['ACTIVE', 'HIDDEN'] } }).lean();
  let created = 0;
  let failed = 0;
  for (const business of businesses) {
    // One business failing (e.g. a duplicate-key error if this run raced another
    // instance of the same cron) must not abort the whole batch — every other
    // business still needs its invoice generated this month.
    try {
      const invoice = await generateInvoiceForBusiness(business, range);
      if (invoice) created += 1;
    } catch (err) {
      failed += 1;
      console.error(`[monthlyInvoices] failed for business ${business._id}:`, err.message);
    }
  }
  console.log(`[monthlyInvoices] generated ${created} invoices for ${range.month}${failed ? `, ${failed} failed` : ''}`);
}

module.exports = { runMonthlyInvoices, generateInvoiceForBusiness, previousMonthRange, isInvoiceGenerationDay };
