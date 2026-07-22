const { callAdminApi } = require('../serviceAuth');
const { createPending } = require('../confirmationStore');
const { formatConfirmationPrompt, formatNumberedList } = require('../messageFormatting');

// Same keyword-command approach as businessAgent.js (see its header comment
// for why — Phase 8 in the plan is where a real NLU router replaces this, if
// it turns out to be needed).
const PERIOD_WORDS = {
  місяць: 'month',
  квартал: 'quarter',
  півроку: 'half-year',
  '9місяців': '9-months',
  '9 місяців': '9-months',
  рік: 'year',
};

function money(n) {
  return `${Number(n).toLocaleString('uk-UA', { maximumFractionDigits: 2 })} грн`;
}

async function report(period) {
  const res = await callAdminApi('GET', `/api/admin/platform-ledger/reports/${period}`);
  if (res.status >= 400) return `Не вдалося отримати звіт: ${res.status}`;
  const { totals } = res.body;
  return [
    `Звіт за період "${period}" (по ${res.body.endMonth}):`,
    `Валовий дохід: ${money(totals.grossRevenue)}`,
    `Витрати: ${money(totals.totalExpenses)}`,
    `Чистий прибуток: ${money(totals.netPayout)} (маржа ${totals.marginPercent}%)`,
    `Отримана комісія: ${money(totals.collectedCommission)}`,
    `Нарахована комісія: ${money(totals.accruedCommission)}`,
    `Отримано за TOP: ${money(totals.collectedTopPlacements)}`,
  ].join('\n');
}

async function todayGross() {
  const res = await callAdminApi('GET', '/api/admin/platform-ledger/today-gross');
  if (res.status >= 400) return `Не вдалося отримати дані: ${res.status}`;
  return `Валова комісія за сьогодні (${res.body.date}): ${money(res.body.grossCommission)}\n(це валовий показник — чистий прибуток за день порахувати не можна, бо витрати вносяться помісячно)`;
}

// "комісія Studio" / "топ Studio на 7 днів" both need to resolve a business by
// free-text name first — a partial, case-insensitive match. Ambiguous or
// zero matches always get an explicit list/refusal, never a guess.
async function findBusinessesByName(nameQuery) {
  const res = await callAdminApi('GET', `/api/admin/businesses?status=ACTIVE`);
  if (res.status >= 400) return [];
  const q = nameQuery.trim().toLowerCase();
  return (res.body.businesses || []).filter((b) => b.name.toLowerCase().includes(q));
}

async function lifetimeCommission(business) {
  const res = await callAdminApi('GET', `/api/admin/businesses/${business._id}/lifetime-commission`);
  if (res.status >= 400) return `Не вдалося отримати дані: ${res.status}`;
  return [
    `Комісія з бізнесу "${res.body.business.name}" за весь час:`,
    `Нараховано: ${money(res.body.accruedCommission)}`,
    `Фактично отримано (оплачені рахунки): ${money(res.body.collectedCommission)}`,
  ].join('\n');
}

async function handleCommand(chatId, text) {
  const normalized = text.trim().toLowerCase();

  if (/^(сьогодні|today)$/.test(normalized)) return todayGross();

  const reportMatch = normalized.match(/^звіт\s+(.+)$/);
  if (reportMatch) {
    const period = PERIOD_WORDS[reportMatch[1].trim()];
    if (!period) {
      return `Не розпізнав період. Доступні: ${Object.keys(PERIOD_WORDS).filter((k) => !k.includes(' ')).join(', ')}.`;
    }
    return report(period);
  }

  const commissionMatch = normalized.match(/^комісія\s+(.+)$/);
  if (commissionMatch) {
    const matches = await findBusinessesByName(commissionMatch[1]);
    if (matches.length === 0) return 'Не знайшов активний бізнес з такою назвою.';
    if (matches.length > 1) {
      return `Знайшов декілька бізнесів, уточни назву:\n${formatNumberedList(matches.map((b) => b.name))}`;
    }
    return lifetimeCommission(matches[0]);
  }

  const topMatch = normalized.match(/^топ\s+(.+?)\s+на\s+(\d+)\s*дн/);
  if (topMatch) {
    const [, nameQuery, daysStr] = topMatch;
    const days = parseInt(daysStr, 10);
    const matches = await findBusinessesByName(nameQuery);
    if (matches.length === 0) return 'Не знайшов активний бізнес з такою назвою.';
    if (matches.length > 1) {
      return `Знайшов декілька бізнесів, уточни назву:\n${formatNumberedList(matches.map((b) => b.name))}`;
    }
    const business = matches[0];
    const action = { agent: 'finance', verb: 'grant-top', businessId: business._id, businessName: business.name, durationDays: days };
    const summary = `Надати TOP-розміщення бізнесу "${business.name}" на ${days} дн.`;
    createPending(chatId, action, summary);
    return formatConfirmationPrompt(summary);
  }

  return null;
}

async function executeConfirmed(action) {
  if (action.verb === 'grant-top') {
    const res = await callAdminApi('POST', `/api/admin/businesses/${action.businessId}/grant-top`, { durationDays: action.durationDays });
    if (res.status >= 400) return `Не вдалося надати TOP: ${res.status} ${JSON.stringify(res.body)}`;
    return `Готово: TOP надано бізнесу "${action.businessName}" на ${action.durationDays} дн.`;
  }
  // The two verbs below are only ever created by utils/telegramNotifier.js
  // (Phase 5's proactive receipt push), never by a chat command — the admin
  // is confirming a payment a business already claimed to have made, not
  // asking the bot to invent an action.
  if (action.verb === 'confirm-top') {
    const res = await callAdminApi('POST', `/api/admin/top-placements/${action.id}/confirm`);
    if (res.status >= 400) return `Не вдалося підтвердити TOP: ${res.status} ${JSON.stringify(res.body)}`;
    return `TOP-розміщення підтверджено для "${action.businessName}".`;
  }
  if (action.verb === 'mark-paid-invoice') {
    const res = await callAdminApi('POST', `/api/admin/invoices/${action.id}/mark-paid`);
    if (res.status >= 400) return `Не вдалося підтвердити оплату: ${res.status} ${JSON.stringify(res.body)}`;
    return `Оплату рахунку підтверджено для "${action.businessName}".`;
  }
  return 'Невідома дія Finance Agent.';
}

// Only reachable via webhookRoute.js's "відхили [причина]" special-case for a
// pending action that carries a `rejectVerb` (see telegramNotifier.js) — a
// real reject-with-reason, distinct from "ні" cancelling the confirmation
// outright and taking no action at all.
async function executeRejected(action, reason) {
  if (action.rejectVerb === 'reject-top') {
    const res = await callAdminApi('POST', `/api/admin/top-placements/${action.id}/reject`, { reason });
    if (res.status >= 400) return `Не вдалося відхилити: ${res.status} ${JSON.stringify(res.body)}`;
    return `TOP-розміщення відхилено для "${action.businessName}".`;
  }
  if (action.rejectVerb === 'reject-receipt-invoice') {
    const res = await callAdminApi('POST', `/api/admin/invoices/${action.id}/reject-receipt`, { reason });
    if (res.status >= 400) return `Не вдалося відхилити: ${res.status} ${JSON.stringify(res.body)}`;
    return `Квитанцію відхилено для "${action.businessName}".`;
  }
  return 'Невідома дія відхилення.';
}

const HELP_TEXT = [
  'Команди Finance Agent:',
  '"сьогодні" — валова комісія за сьогодні',
  '"звіт місяць/квартал/півроку/9місяців/рік" — фінансовий звіт за період',
  '"комісія <назва бізнесу>" — нарахована/отримана комісія з бізнесу за весь час',
  '"топ <назва бізнесу> на N днів" — надати TOP-розміщення',
].join('\n');

module.exports = { handleCommand, executeConfirmed, executeRejected, HELP_TEXT };
