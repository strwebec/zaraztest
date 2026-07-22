// Plain, unambiguous text formatting shared by every agent's confirmation
// prompts — no Markdown/HTML parse-mode, since a stray '_' or '*' in a
// business/category name would otherwise break Telegram's formatting parser.

function formatNumberedList(items) {
  return items.map((item, i) => `${i + 1}. ${item}`).join('\n');
}

function formatConfirmationPrompt(summary) {
  return `${summary}\n\nПідтверди: напиши "так". Щоб скасувати — напиши "ні".`;
}

function formatUnclearReply() {
  return 'Не зрозумів відповідь. Напиши "так" щоб підтвердити дію, або "ні" щоб скасувати.';
}

function formatExpired() {
  return 'Цей запит на підтвердження застарів (минуло 10+ хвилин). Повтори команду.';
}

function formatNoPending() {
  return 'Немає дії, що очікує підтвердження.';
}

function formatCancelled() {
  return 'Скасовано.';
}

module.exports = {
  formatNumberedList,
  formatConfirmationPrompt,
  formatUnclearReply,
  formatExpired,
  formatNoPending,
  formatCancelled,
};
