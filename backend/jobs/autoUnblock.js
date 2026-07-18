const Business = require('../models/Business');
const Invoice = require('../models/Invoice');
const Booking = require('../models/Booking');
const { sendMail } = require('../utils/mailer');
const User = require('../models/User');

const DAY_MS = 24 * 60 * 60 * 1000;

async function escalateOverdueInvoices() {
  const now = Date.now();
  const overdue = await Invoice.find({ status: { $in: ['PENDING', 'OVERDUE'] } });

  for (const invoice of overdue) {
    const daysSinceIssued = (now - new Date(invoice.issuedAt).getTime()) / DAY_MS;
    const business = await Business.findById(invoice.business);
    if (!business) continue;

    if (daysSinceIssued >= 14) {
      invoice.status = 'BLOCKED';
      business.status = 'BLOCKED';
      business.billing.status = 'BLOCKED';
      await Promise.all([invoice.save(), business.save()]);
    } else if (daysSinceIssued >= 11) {
      if (invoice.status !== 'OVERDUE') invoice.status = 'OVERDUE';
      if (!invoice.warnedAt) {
        invoice.warnedAt = new Date();
        const owner = await User.findById(business.owner).lean();
        if (owner) {
          await sendMail({
            to: owner.email,
            subject: 'Останнє попередження — рахунок ZARAZ прострочено',
            html: `Рахунок за ${invoice.month} досі не оплачено. При несплаті до 14 днів профіль буде заблоковано. Це може мати юридичні наслідки.`,
          });
        }
      }
      await invoice.save();
    } else if (daysSinceIssued >= 8) {
      invoice.status = 'OVERDUE';
      if (business.status === 'ACTIVE') business.status = 'HIDDEN';
      business.billing.status = 'OVERDUE';
      business.billing.unpaidSince = business.billing.unpaidSince || invoice.issuedAt;
      await Promise.all([invoice.save(), business.save()]);
    }
  }
}

// Admin-issued blocks with a fixed duration (blockedUntil) lift themselves once
// that date passes — this only ever fires for blocks the admin explicitly gave
// a duration to; the billing-overdue auto-block above never sets blockedUntil,
// so it's untouched by this sweep.
async function unblockExpiredBusinessBans() {
  await Business.updateMany(
    { status: 'BLOCKED', blockedUntil: { $lte: new Date() } },
    { $set: { status: 'ACTIVE' }, $unset: { blockedUntil: 1, blockReason: 1 } }
  );
}

async function expireTopPlacements() {
  await Business.updateMany(
    { 'top.active': true, 'top.until': { $lt: new Date() } },
    { 'top.active': false }
  );
}

async function resolveUnansweredCancellations() {
  const cutoff = new Date(Date.now() - DAY_MS);
  const pending = await Booking.find({
    status: 'cancelled_by_business',
    'cancellationConfirmation.askedAt': { $lte: cutoff },
    'cancellationConfirmation.respondedAt': { $exists: false },
    'cancellationConfirmation.processed': { $ne: true },
  });

  for (const booking of pending) {
    booking.cancellationConfirmation.processed = true;
    await booking.save();
    await applyUnfairCancellation(booking.business);
  }
}

async function applyUnfairCancellation(businessId) {
  const business = await Business.findById(businessId);
  if (!business) return;

  business.unfairCancellations += 1;

  if (business.unfairCancellations === 3) {
    business.warnings += 1;
  } else if (business.unfairCancellations === 6) {
    business.catalogPenaltyUntil = new Date(Date.now() + 30 * DAY_MS);
  } else if (business.unfairCancellations === 9) {
    business.underReview = true;
  }

  await business.save();
}

async function runDailySweep() {
  await Promise.all([
    escalateOverdueInvoices(),
    expireTopPlacements(),
    resolveUnansweredCancellations(),
    unblockExpiredBusinessBans(),
  ]);
  console.log('[autoUnblock] daily sweep complete');
}

module.exports = { runDailySweep, applyUnfairCancellation };
