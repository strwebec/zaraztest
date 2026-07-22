const { telegramWebhookLimiter } = require('../middleware/rateLimit');
const { sendMessage } = require('./client');
const { callAdminApi } = require('./serviceAuth');

// Phase 1 scope only: prove the webhook pipe end-to-end (echo + one read-only
// admin figure). Agent command routing (Business/Finance/Security) is added in
// later phases, on top of this same handler.
async function handleIncomingMessage(update) {
  const chatId = update.message?.chat?.id;
  const text = update.message?.text;
  if (!chatId || !text) return;

  let countsLine;
  try {
    const counts = await callAdminApi('GET', '/api/admin/pending-counts');
    countsLine = `pending-counts: ${JSON.stringify(counts.body)}`;
  } catch (err) {
    countsLine = `(не вдалось отримати pending-counts: ${err.message})`;
  }

  await sendMessage(chatId, `echo: ${text}\n\n${countsLine}`);
}

// Three independent layers, checked in this order, before a single byte of the
// update body is trusted or acted on:
//  1. Telegram's own secret token (X-Telegram-Bot-Api-Secret-Token) — set via
//     setWebhook, echoed back on every genuine call. Mismatch -> 404 (not
//     401/403), so a scan doesn't even learn this route exists.
//  2. A hardcoded single authorized chat id — everything else is silently
//     ignored (200 OK, no action, no reply) rather than erroring, so a
//     stranger who somehow finds the bot can't even tell it's listening.
//  3. telegramWebhookLimiter (middleware/rateLimit.js), same as every other
//     rate-limited route in this app.
// See .claude/plans/tidy-tickling-wilkinson.md for the full rationale.
function mountTelegramWebhook(app) {
  const { TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, TELEGRAM_AUTHORIZED_CHAT_ID, TELEGRAM_WEBHOOK_PATH_SEGMENT } =
    process.env;

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_WEBHOOK_SECRET || !TELEGRAM_AUTHORIZED_CHAT_ID || !TELEGRAM_WEBHOOK_PATH_SEGMENT) {
    console.log('[telegram/webhookRoute] Telegram env vars not fully set — webhook route disabled');
    return;
  }

  app.post(`/api/telegram/webhook/${TELEGRAM_WEBHOOK_PATH_SEGMENT}`, telegramWebhookLimiter, (req, res) => {
    const secretHeader = req.get('X-Telegram-Bot-Api-Secret-Token');
    if (secretHeader !== TELEGRAM_WEBHOOK_SECRET) {
      return res.status(404).end();
    }

    const update = req.body || {};
    const chatId = update.message?.chat?.id ?? update.callback_query?.message?.chat?.id;
    if (String(chatId) !== String(TELEGRAM_AUTHORIZED_CHAT_ID)) {
      return res.status(200).end();
    }

    // Ack Telegram immediately — it retries on anything but a fast 2xx, and
    // the actual work (calling our own admin API, calling Telegram back) can
    // safely happen after the response is already on the wire.
    res.status(200).end();
    handleIncomingMessage(update).catch((err) => console.error('[telegram/webhookRoute] handling failed', err));
  });

  console.log('[telegram/webhookRoute] webhook route mounted');
}

module.exports = { mountTelegramWebhook };
