const nodemailer = require('nodemailer');

let transporter = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    // Some hosts (notably free-tier PaaS containers) block outbound SMTP ports
    // entirely, which otherwise hangs the connection attempt for minutes. Fail
    // fast so a blocked/broken mail server can never take the whole request
    // (and the caller's DB writes that already succeeded) down with it.
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 8000,
  });
}

// By the time this is called, the caller has already persisted whatever the
// email is confirming (a new account, a verification code) — a mail server
// being slow, misconfigured, or blocked by the host must never turn into a
// 500 that hides a registration that actually succeeded. Always log the
// dev-mode fallback line on failure too, so the verification code stays
// recoverable from server logs even when real delivery is broken.
async function sendMail({ to, subject, html }) {
  if (!transporter) {
    console.log(`[mailer:dev] would send email to ${to}\nSubject: ${subject}\n${html}`);
    return;
  }
  try {
    await transporter.sendMail({ from: process.env.SMTP_USER, to, subject, html });
  } catch (err) {
    console.error(`[mailer] send failed for ${to}:`, err.message);
    console.log(`[mailer:dev-fallback] would send email to ${to}\nSubject: ${subject}\n${html}`);
  }
}

module.exports = { sendMail };
