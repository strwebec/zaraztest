require('dotenv').config();
const bcrypt = require('bcrypt');
const { connectDB } = require('../config/db');
const User = require('../models/User');

// One-off, safely re-runnable script — creates (or refreshes the permissions/
// password of) the least-privilege ADMIN service account the Telegram bot
// logs in as (see telegram/serviceAuth.js). Deliberately narrow permissions,
// deliberately NOT SUPER_ADMIN — see .claude/plans/tidy-tickling-wilkinson.md
// for the full reasoning. Unlike seed/seed.js, this NEVER deletes anything.
const BOT_PERMISSIONS = ['businesses', 'categories', 'reviews', 'topPlacements', 'finance', 'support'];

async function run() {
  const email = process.env.TELEGRAM_BOT_SERVICE_EMAIL;
  const password = process.env.TELEGRAM_BOT_SERVICE_PASSWORD;
  if (!email || !password) {
    console.error('[createTelegramBotAccount] set TELEGRAM_BOT_SERVICE_EMAIL and TELEGRAM_BOT_SERVICE_PASSWORD first');
    process.exit(1);
  }

  await connectDB();
  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await User.findOne({ email: email.toLowerCase() });

  if (existing) {
    existing.role = 'ADMIN';
    existing.permissions = BOT_PERMISSIONS;
    existing.emailVerified = true;
    existing.passwordHash = passwordHash;
    await existing.save();
    console.log(`[createTelegramBotAccount] updated existing account: ${email}`);
  } else {
    await User.create({
      role: 'ADMIN',
      name: 'ZARAZ Telegram Bot',
      email: email.toLowerCase(),
      passwordHash,
      emailVerified: true,
      permissions: BOT_PERMISSIONS,
    });
    console.log(`[createTelegramBotAccount] created: ${email}`);
  }
  process.exit(0);
}

run().catch((err) => {
  console.error('[createTelegramBotAccount] failed', err);
  process.exit(1);
});
