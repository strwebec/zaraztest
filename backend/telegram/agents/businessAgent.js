const { callAdminApi } = require('../serviceAuth');
const { createPending, getPending, clearPending } = require('../confirmationStore');
const { formatNumberedList, formatConfirmationPrompt } = require('../messageFormatting');

// Phase 3 scope: keyword commands, not full NLU (see Phase 8 in
// .claude/plans/tidy-tickling-wilkinson.md — a real NLU router is only added
// later, if keyword matching turns out to be too brittle in practice).
//
// "схвали N"/"відхили N [причина]" resolve N against whatever list this chat
// last saw (categories/businesses/reviews) — a fresh list always replaces the
// previous one, same one-pending-thing-at-a-time model as confirmationStore.
const lastLists = new Map();

function setLastList(chatId, type, items) {
  lastLists.set(String(chatId), { type, items });
}

function getLastList(chatId) {
  return lastLists.get(String(chatId)) || null;
}

async function listCategories(chatId) {
  const res = await callAdminApi('GET', '/api/admin/categories');
  const categories = res.body.categories || [];
  if (!categories.length) return 'Немає категорій на розгляді.';
  const items = categories.map((c) => ({
    id: c._id,
    label: `${c.name}${c.requestedByBusiness?.name ? ` (запросив бізнес: ${c.requestedByBusiness.name})` : ''}`,
  }));
  setLastList(chatId, 'category', items);
  return `Категорії на розгляді:\n${formatNumberedList(items.map((i) => i.label))}\n\nСхвалити: "схвали N". Відхилити: "відхили N".`;
}

async function listBusinesses(chatId) {
  const res = await callAdminApi('GET', '/api/admin/businesses?status=PENDING');
  const businesses = res.body.businesses || [];
  if (!businesses.length) return 'Немає бізнесів на розгляді.';
  const items = businesses.map((b) => ({
    id: b._id,
    label: `${b.name} — ${b.city?.name || 'без міста'} (власник: ${b.owner?.name || '?'}, ${b.owner?.email || '?'})`,
  }));
  setLastList(chatId, 'business', items);
  return `Бізнеси на розгляді:\n${formatNumberedList(items.map((i) => i.label))}\n\nСхвалити: "схвали N". Відхилити: "відхили N причина".`;
}

async function listReviews(chatId) {
  const res = await callAdminApi('GET', '/api/admin/reviews');
  const reviews = res.body.reviews || [];
  if (!reviews.length) return 'Немає відгуків на розгляді.';
  const items = reviews.map((r) => ({
    id: r._id,
    label: `${r.business?.name || '?'} — ${r.rating}★ від ${r.client?.name || '?'}: "${(r.text || '').slice(0, 80)}"`,
  }));
  setLastList(chatId, 'review', items);
  return `Відгуки на розгляді:\n${formatNumberedList(items.map((i) => i.label))}\n\nСхвалити: "схвали N". Відхилити: "відхили N".`;
}

async function listTickets() {
  const res = await callAdminApi('GET', '/api/support/admin/threads');
  const threads = res.body.threads || [];
  const unread = threads.filter((t) => t.status === 'ACTIVE' && t.unreadByAdmin > 0);
  if (!unread.length) return 'Немає непрочитаних звернень у підтримку.';
  const lines = unread.map((t) => `${t.userName} (${t.userRole}) — ${t.unreadByAdmin} непрочит., останнє: "${(t.lastMessagePreview || '').slice(0, 60)}"`);
  return `Непрочитані звернення у підтримку:\n${formatNumberedList(lines)}`;
}

async function digest() {
  const [categoriesRes, businessesRes, reviewsRes, ticketsRes, cityCountsRes] = await Promise.all([
    callAdminApi('GET', '/api/admin/categories'),
    callAdminApi('GET', '/api/admin/businesses?status=PENDING'),
    callAdminApi('GET', '/api/admin/reviews'),
    callAdminApi('GET', '/api/support/admin/threads'),
    callAdminApi('GET', '/api/admin/cities/business-counts'),
  ]);
  const pendingCategories = (categoriesRes.body.categories || []).length;
  const pendingBusinesses = (businessesRes.body.businesses || []).length;
  const pendingReviews = (reviewsRes.body.reviews || []).length;
  const unreadTickets = (ticketsRes.body.threads || []).filter((t) => t.status === 'ACTIVE' && t.unreadByAdmin > 0).length;
  const emptyCities = (cityCountsRes.body.cities || []).filter((c) => c.businessCount === 0).map((c) => c.name);

  const lines = [
    `Категорій на розгляді: ${pendingCategories}`,
    `Бізнесів на розгляді: ${pendingBusinesses}`,
    `Відгуків на розгляді: ${pendingReviews}`,
    `Непрочитаних звернень підтримки: ${unreadTickets}`,
    emptyCities.length ? `Міста без жодного бізнесу: ${emptyCities.join(', ')}` : 'Міста без жодного бізнесу: немає',
  ];
  return `Дайджест ZARAZ:\n${lines.join('\n')}`;
}

const APPROVE_PATH = { category: (id) => `/api/admin/categories/${id}/approve`, business: (id) => `/api/admin/businesses/${id}/approve`, review: (id) => `/api/admin/reviews/${id}/approve` };
const REJECT_PATH = { category: (id) => `/api/admin/categories/${id}/reject`, business: (id) => `/api/admin/businesses/${id}/reject`, review: (id) => `/api/admin/reviews/${id}/reject` };
const TYPE_LABEL = { category: 'категорію', business: 'бізнес', review: 'відгук' };

// Returns a reply string, or null if `text` isn't a Business Agent command
// (so the caller — webhookRoute.js — can fall through to other agents).
async function handleCommand(chatId, text) {
  const normalized = text.trim().toLowerCase();

  if (/^(категорі[їі]|categories)$/.test(normalized)) return listCategories(chatId);
  if (/^(бізнеси|бизнесы|businesses)$/.test(normalized)) return listBusinesses(chatId);
  if (/^(відгуки|отзывы|reviews)$/.test(normalized)) return listReviews(chatId);
  if (/^(тікети|тикеты|звернення|support|tickets)$/.test(normalized)) return listTickets();
  if (/^(дайджест|digest)$/.test(normalized)) return digest();

  const approveMatch = normalized.match(/^схвали\s+(\d+)$/) || normalized.match(/^approve\s+(\d+)$/);
  const rejectMatch = normalized.match(/^відхили\s+(\d+)(?:\s+(.*))?$/) || normalized.match(/^reject\s+(\d+)(?:\s+(.*))?$/);

  if (approveMatch || rejectMatch) {
    const match = approveMatch || rejectMatch;
    const index = parseInt(match[1], 10) - 1;
    const reason = rejectMatch ? rejectMatch[2] : undefined;
    const list = getLastList(chatId);
    if (!list || !list.items[index]) {
      return 'Не знайшов такий номер у останньому показаному списку. Спочатку запроси список ("категорії"/"бізнеси"/"відгуки").';
    }
    const { type, items } = list;
    const item = items[index];
    const verb = approveMatch ? 'approve' : 'reject';
    const action = { agent: 'business', verb, type, id: item.id, reason };
    const summary = `${verb === 'approve' ? 'Схвалити' : 'Відхилити'} ${TYPE_LABEL[type]}: ${item.label}${reason ? `\nПричина: ${reason}` : ''}`;
    createPending(chatId, action, summary);
    return formatConfirmationPrompt(summary);
  }

  return null;
}

// Called by webhookRoute.js once confirmationStore.resolveReply() has already
// classified the reply as 'confirm' for a pending action with agent==='business'.
async function executeConfirmed(action) {
  const path = action.verb === 'approve' ? APPROVE_PATH[action.type](action.id) : REJECT_PATH[action.type](action.id);
  const body = action.verb === 'reject' && action.type === 'business' ? { reason: action.reason } : undefined;
  const res = await callAdminApi('POST', path, body);
  if (res.status >= 400) {
    return `Не вдалося виконати дію: ${res.status} ${JSON.stringify(res.body)}`;
  }
  return `Готово: ${action.verb === 'approve' ? 'схвалено' : 'відхилено'}.`;
}

const HELP_TEXT = [
  'Команди Business Agent:',
  '"категорії" — список категорій на розгляді',
  '"бізнеси" — список бізнесів на розгляді',
  '"відгуки" — список відгуків на розгляді',
  '"тікети" — непрочитані звернення підтримки',
  '"дайджест" — короткий загальний огляд',
  '"схвали N" / "відхили N [причина]" — дія над пунктом N з останнього показаного списку',
].join('\n');

module.exports = { handleCommand, executeConfirmed, HELP_TEXT };
