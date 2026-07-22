const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

// Emails are built as raw HTML template strings, not through a
// templating engine that escapes by default — any value that ultimately came
// from a user (a client's registration name, a business's chosen name) must be
// escaped before interpolation so it can't break out of the surrounding markup
// in whatever the recipient's mail client renders.
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

module.exports = { escapeHtml };
