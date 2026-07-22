// Shared "are you sure?" primitive for every agent (Business/Finance/Security).
// Deliberately in-memory, not persisted to Mongo — a lost pending confirmation
// on a Render restart just means the owner re-sends the command, which is a
// perfectly fine v1 tradeoff (see .claude/plans/tidy-tickling-wilkinson.md).
// One pending confirmation per chat at a time: a second command before the
// first is answered simply replaces it, rather than queuing, since there's
// only ever one human on the other end of this chat.
const TTL_MS = 10 * 60 * 1000;

const pending = new Map();

// `action` is an opaque descriptor the caller defines and later reads back
// out of `confirm()` — this module never interprets it, just holds it.
function createPending(chatId, action, summary) {
  const record = { action, summary, createdAt: Date.now(), expiresAt: Date.now() + TTL_MS };
  pending.set(String(chatId), record);
  return record;
}

// Returns null only when nothing was ever pending for this chat. A record
// that existed but aged out still comes back (with `expired: true`) so the
// caller can send an explicit "this request expired" reply instead of
// silently falling through to command parsing as if nothing had happened.
function getPending(chatId) {
  const record = pending.get(String(chatId));
  if (!record) return null;
  if (record.expiresAt < Date.now()) {
    pending.delete(String(chatId));
    return { ...record, expired: true };
  }
  return record;
}

function clearPending(chatId) {
  pending.delete(String(chatId));
}

const AFFIRMATIVE_RE = /^(так|підтверджую|підтвердити|підтверджуй|confirm|yes|ок|окей)\.?!?$/i;
const NEGATIVE_RE = /^(ні|нi|скасувати|скасуй|cancel|no|відміна|відмінити)\.?!?$/i;

// A reply to a pending confirmation is exactly one of three things — never a
// guess at what the user "probably" meant. Anything that isn't a clear yes/no
// comes back 'unclear' so the caller re-prompts instead of acting.
function resolveReply(text) {
  const normalized = (text || '').trim();
  if (AFFIRMATIVE_RE.test(normalized)) return 'confirm';
  if (NEGATIVE_RE.test(normalized)) return 'cancel';
  return 'unclear';
}

module.exports = { createPending, getPending, clearPending, resolveReply };
