const nodemailer = require('nodemailer');

let transporter = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

async function sendMail({ to, subject, html }) {
  if (!transporter) {
    console.log(`[mailer:dev] would send email to ${to}\nSubject: ${subject}\n${html}`);
    return;
  }
  await transporter.sendMail({ from: process.env.SMTP_USER, to, subject, html });
}

module.exports = { sendMail };
