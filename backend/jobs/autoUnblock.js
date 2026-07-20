const Business = require('../models/Business');
const Invoice = require('../models/Invoice');
const Booking = require('../models/Booking');
const Notification = require('../models/Notification');
const { sendMail } = require('../utils/mailer');
const User = require('../models/User');

const DAY_MS = 24 * 60 * 60 * 1000;
const RESET_WINDOW_MS = 182 * DAY_MS;
// The first FREE_UNFAIR_CANCELLATIONS unfair cancellations in a 6-month window are
// silent — no warning, no notification. The next one is a single warning. Every one
// after that (re)applies a 30-day catalog-visibility restriction. Once the business
// has racked up REVIEW_THRESHOLD in the window, it's escalated to a human admin.
const FREE_UNFAIR_CANCELLATIONS = 3;
const WARNING_AT = FREE_UNFAIR_CANCELLATIONS + 1;
const PENALTY_DAYS = 30;
const REVIEW_THRESHOLD = FREE_UNFAIR_CANCELLATIONS + 5;

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

  // A stale window (or a business that's never had one, pre-migration) resets the
  // slate — an unfair cancellation from 7 months ago shouldn't still count today.
  if (!business.unfairCancellationsSince || Date.now() - business.unfairCancellationsSince.getTime() > RESET_WINDOW_MS) {
    business.unfairCancellations = 0;
    business.warnings = 0;
    business.unfairCancellationsSince = new Date();
  }

  business.unfairCancellations += 1;
  const count = business.unfairCancellations;

  const notify = (title, text) =>
    business.owner ? Notification.create({ user: business.owner, type: 'unfair_cancellation_notice', title, text }) : null;

  if (count < WARNING_AT) {
    // Within the free allowance — no consequence, no notification.
  } else if (count === WARNING_AT) {
    business.warnings += 1;
    await notify(
      'Попередження щодо скасувань',
      `Це вже ${count}-та бронь, яку ви скасували без пояснення за останні пів року (безкоштовний ліміт — ${FREE_UNFAIR_CANCELLATIONS}). ` +
        `Якщо це повториться, заклад тимчасово матиме нижчу видимість у каталозі на ${PENALTY_DAYS} днів. ` +
        `Щоб уникнути обмежень — не скасовуйте підтверджені записи без поважної причини; якщо скасування дійсно потрібне, завжди погоджуйте це з клієнтом заздалегідь, щоб він підтвердив це у своєму акаунті.`
    );
  } else if (count < REVIEW_THRESHOLD) {
    business.catalogPenaltyUntil = new Date(Date.now() + PENALTY_DAYS * DAY_MS);
    await notify(
      'Тимчасове обмеження видимості в каталозі',
      `Через систематичні скасування підтверджених записів без пояснення (${count} за останні пів року) заклад матиме нижчу видимість у каталозі до ${business.catalogPenaltyUntil.toLocaleDateString('uk-UA')}. ` +
        `Кожне наступне таке скасування продовжує обмеження ще на ${PENALTY_DAYS} днів і наближає заклад до ручного розгляду адміністрацією. ` +
        `Щоб зняти ризик — просто не скасовуйте підтверджені записи без поважної причини протягом наступних пів року.`
    );
  } else {
    business.underReview = true;
    await notify(
      'Заклад передано на розгляд адміністрації',
      `Кількість скасованих вами записів без пояснення (${count} за пів року) перевищила допустиму межу. Ваш профіль передано на ручний розгляд адміністрації ZARAZ — можливе тимчасове блокування.`
    );
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
