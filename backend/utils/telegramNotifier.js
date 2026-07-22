const { sendMessage } = require('../telegram/client');
const { createPending } = require('../telegram/confirmationStore');
const { formatConfirmationPrompt } = require('../telegram/messageFormatting');

// Mirrors utils/mailer.js's sendMail() exactly: by the time this is called,
// the caller (routes/business.js) has already persisted the receipt and
// already sent its own response to the business — a missing/broken Telegram
// config, a Telegram API outage, or any other failure here must NEVER turn
// into (or even delay) that response. Always call this AFTER res.json(...),
// without await.
//
// Creates a pending confirmation the same way any chat-driven command would
// (see telegram/confirmationStore.js) — replying "підтверджую"/"так" runs
// `action` via the named agent's executeConfirmed(); replying
// "відхили [причина]" runs `action.rejectVerb` via that agent's
// executeRejected() instead (see webhookRoute.js). Note this overwrites
// whatever pending confirmation the chat already had — v1 only ever tracks
// one pending item per chat (see confirmationStore.js's own header comment);
// a receipt arriving mid-approval of something unrelated silently replaces
// it. Acceptable for v1 given how infrequent both events are; worth
// revisiting if it ever causes a real mix-up.
async function notifyPaymentReceipt(action, summary) {
  const chatId = process.env.TELEGRAM_AUTHORIZED_CHAT_ID;
  if (!chatId || !process.env.TELEGRAM_BOT_TOKEN) {
    console.log('[telegramNotifier] not configured — receipt notification not sent:', summary.split('\n')[0]);
    return;
  }
  try {
    createPending(chatId, action, summary);
    await sendMessage(chatId, formatConfirmationPrompt(summary));
  } catch (err) {
    console.error('[telegramNotifier] notifyPaymentReceipt failed:', err.message);
  }
}

// Plain, no-confirmation-needed broadcast — for Security Agent v1 alerts
// (Dependabot, sensitive AdminAuditLog entries), which are observe-and-alert
// only in this version (no auto-fix/auto-deploy, see
// .claude/plans/tidy-tickling-wilkinson.md). Same never-throws contract as
// notifyPaymentReceipt above.
async function notify(text) {
  const chatId = process.env.TELEGRAM_AUTHORIZED_CHAT_ID;
  if (!chatId || !process.env.TELEGRAM_BOT_TOKEN) {
    console.log('[telegramNotifier] not configured — alert not sent:', text.split('\n')[0]);
    return;
  }
  try {
    await sendMessage(chatId, text);
  } catch (err) {
    console.error('[telegramNotifier] notify failed:', err.message);
  }
}

module.exports = { notifyPaymentReceipt, notify };
