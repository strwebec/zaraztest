const Business = require('../models/Business');
const Invoice = require('../models/Invoice');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { sendMail } = require('../utils/mailer');

const DAY_MS = 24 * 60 * 60 * 1000;

// Runs daily at 09:00. Once an invoice has been unpaid for 24h, the owner gets one
// reminder per day (cabinet notification + email) until it's paid — separate from
// the one-time 11-day "final warning" escalation email in autoUnblock.js.
async function sendDailyPaymentReminders() {
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const cutoff = new Date(now.getTime() - DAY_MS);

  // AWAITING_VERIFICATION is excluded: the business has already submitted a receipt
  // and is waiting on admin review, so it's not the one holding up payment anymore.
  const unpaid = await Invoice.find({
    status: { $in: ['PENDING', 'OVERDUE', 'BLOCKED'] },
    issuedAt: { $lte: cutoff },
  });

  let sent = 0;
  for (const invoice of unpaid) {
    const alreadySentToday =
      invoice.lastReminderAt && new Date(invoice.lastReminderAt).toISOString().slice(0, 10) === todayKey;
    if (alreadySentToday) continue;

    const business = await Business.findById(invoice.business);
    if (!business) continue;
    const owner = await User.findById(business.owner);
    if (!owner) continue;

    const dueDate = invoice.dueAt.toISOString().slice(0, 10);
    const text = `Рахунок за ${invoice.month} (${invoice.totalCommission}₴) ще не оплачено. Оплатіть до ${dueDate}.`;

    await Notification.create({
      user: owner._id,
      type: 'invoice_payment_reminder',
      title: 'Нагадування про оплату рахунку',
      text,
    });

    await sendMail({
      to: owner.email,
      subject: 'Нагадування про оплату рахунку — ZARAZ',
      html: text,
    });

    invoice.lastReminderAt = now;
    await invoice.save();
    sent += 1;
  }

  console.log(`[paymentReminders] sent ${sent} reminders`);
}

module.exports = { sendDailyPaymentReminders };
