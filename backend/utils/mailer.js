const nodemailer = require('nodemailer');
const { Resend } = require('resend');

// Resend sends over HTTPS, not a raw SMTP socket — many hosts (free-tier PaaS
// containers especially) block outbound SMTP ports entirely, which makes
// nodemailer hang or fail on every send. Prefer Resend whenever it's
// configured; SMTP stays available as a fallback for hosts where it does
// work, and logging-only stays the last resort for local dev.
let resend = null;
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
}

let transporter = null;
if (!resend && process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    // Fail fast rather than hang for minutes if the port turns out to be blocked.
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 8000,
  });
}

// In production, printing the full HTML body would leak whatever the email is
// confirming — a 6-digit verification/password-reset code, an invoice amount —
// straight into the hosting provider's log stream, readable by anyone with log
// access, for as long as those logs are retained. Only dev/test environments
// (where nothing sensitive is really being protected) get the full body; a
// misconfigured production deploy instead gets a loud warning with no secret
// in it, so the missing provider config gets noticed and fixed rather than
// silently compensated for by leaking codes into logs.
function logDevFallback(to, subject, html) {
  if (process.env.NODE_ENV === 'production') {
    console.error(
      `[mailer] no email provider configured — email to ${to} ("${subject}") was NOT sent. ` +
        'Set RESEND_API_KEY or SMTP_HOST/SMTP_USER/SMTP_PASS.'
    );
    return;
  }
  console.log(`[mailer:dev-fallback] would send email to ${to}\nSubject: ${subject}\n${html}`);
}

// By the time this is called, the caller has already persisted whatever the
// email is confirming (a new account, a verification code) — a mail
// provider being slow, misconfigured, or blocked by the host must never
// turn into a 500 that hides a registration that actually succeeded.
// Always log the dev-mode fallback line on failure too, so the verification
// code stays recoverable from server logs even when real delivery is broken.
async function sendMail({ to, subject, html }) {
  if (resend) {
    try {
      const { error } = await resend.emails.send({
        from: process.env.RESEND_FROM || 'ZARAZ <onboarding@resend.dev>',
        to,
        subject,
        html,
      });
      if (error) throw new Error(error.message || JSON.stringify(error));
      return;
    } catch (err) {
      console.error(`[mailer] Resend send failed for ${to}:`, err.message);
      logDevFallback(to, subject, html);
      return;
    }
  }

  if (!transporter) {
    logDevFallback(to, subject, html);
    return;
  }
  try {
    await transporter.sendMail({ from: process.env.SMTP_USER, to, subject, html });
  } catch (err) {
    console.error(`[mailer] SMTP send failed for ${to}:`, err.message);
    logDevFallback(to, subject, html);
  }
}

module.exports = { sendMail };
