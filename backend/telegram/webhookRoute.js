const { telegramWebhookLimiter } = require('../middleware/rateLimit');
const { sendMessage } = require('./client');
const { getPending, clearPending, resolveReply } = require('./confirmationStore');
const { formatUnclearReply, formatExpired, formatCancelled } = require('./messageFormatting');
const businessAgent = require('./agents/businessAgent');
const financeAgent = require('./agents/financeAgent');
const securityAgent = require('./agents/securityAgent');

// Every agent's executeConfirmed() lives behind this single dispatch table,
// keyed by the `agent` field each agent stamps onto its own pending action
// (see businessAgent.js's createPending call). securityAgent has no entry
// here — v1 is observation/alerting only, it never creates a pending action
// (see .claude/plans/tidy-tickling-wilkinson.md's Phase 6-8 scoping).
const AGENTS = { business: businessAgent, finance: financeAgent };
// Tried in order until one recognizes the command — see each agent's own
// handleCommand for its keyword set.
const COMMAND_AGENTS = [businessAgent, financeAgent, securityAgent];
const COMBINED_HELP = [businessAgent.HELP_TEXT, financeAgent.HELP_TEXT, securityAgent.HELP_TEXT].join('\n\n');

async function handleIncomingMessage(update) {
  const chatId = update.message?.chat?.id;
  const text = update.message?.text;
  if (!chatId || !text) return;

  const pending = getPending(chatId);
  if (pending) {
    if (pending.expired) {
      await sendMessage(chatId, formatExpired());
      return;
    }

    // Payment-receipt confirmations (Phase 5, see utils/telegramNotifier.js)
    // carry a rejectVerb and support a third reply shape beyond confirm/ні:
    // "відхили [причина]" is a real reject-with-reason action, not the same
    // as "ні" (which just cancels — does nothing, admin can act manually
    // later). Chat-command-originated pendings never set rejectVerb, so this
    // never fires for those.
    if (pending.action.rejectVerb) {
      const rejectMatch = text.trim().match(/^відхили(?:\s+(.*))?$/i);
      if (rejectMatch) {
        clearPending(chatId);
        let reply;
        try {
          reply = await AGENTS[pending.action.agent].executeRejected(pending.action, rejectMatch[1]);
        } catch (err) {
          reply = `Помилка виконання дії: ${err.message}`;
        }
        await sendMessage(chatId, reply);
        return;
      }
    }

    const verdict = resolveReply(text);
    if (verdict === 'unclear') {
      // Deliberately don't clear or fall through to command parsing — the
      // pending action is still exactly what it was, we just didn't
      // understand the reply to it.
      await sendMessage(chatId, formatUnclearReply());
      return;
    }
    clearPending(chatId);
    if (verdict === 'cancel') {
      await sendMessage(chatId, formatCancelled());
      return;
    }
    let reply;
    try {
      reply = await AGENTS[pending.action.agent].executeConfirmed(pending.action);
    } catch (err) {
      reply = `Помилка виконання дії: ${err.message}`;
    }
    await sendMessage(chatId, reply);
    return;
  }

  let reply = null;
  try {
    for (const agent of COMMAND_AGENTS) {
      reply = await agent.handleCommand(chatId, text);
      if (reply !== null) break;
    }
  } catch (err) {
    reply = `Помилка: ${err.message}`;
  }
  await sendMessage(chatId, reply ?? `Не розпізнав команду.\n\n${COMBINED_HELP}`);
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
