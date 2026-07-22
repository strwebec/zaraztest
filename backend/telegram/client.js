const API_BASE = 'https://api.telegram.org';

function botToken() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN not set');
  return token;
}

async function sendMessage(chatId, text) {
  const res = await fetch(`${API_BASE}/bot${botToken()}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.ok === false) {
    throw new Error(`Telegram sendMessage failed: ${res.status} ${JSON.stringify(body)}`);
  }
  return body.result;
}

module.exports = { sendMessage };
