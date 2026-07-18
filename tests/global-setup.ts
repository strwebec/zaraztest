import bcrypt from 'bcryptjs';
import { getDb, closeDb, cleanupTestData, resetPersistentFixtureCounters } from './helpers/db';
import { TEST_USERS } from './fixtures/users';

/**
 * Seeds accounts the app has no self-registration path for. CLIENT and
 * BUSINESS_OWNER can be created through the real /login?tab=register flow (and
 * individual tests do that so registration itself stays covered), but MODERATOR
 * and FINANCE_ADMIN only exist via the admin "Team" invite flow today — for a
 * clean, repeatable suite we seed them directly instead of depending on that flow.
 */
export default async function globalSetup() {
  await cleanupTestData();
  await resetPersistentFixtureCounters(); // in case a prior run was interrupted before its own teardown ran

  const db = await getDb();

  for (const role of ['moderator', 'financeAdmin'] as const) {
    const account = TEST_USERS[role];
    const existing = await db.collection('users').findOne({ email: account.email });
    if (existing) continue;

    const passwordHash = await bcrypt.hash(account.password, 12);
    await db.collection('users').insertOne({
      role: account.role,
      name: account.name,
      email: account.email,
      passwordHash,
      emailVerified: true,
      rating: 5,
      consecutiveViolations: 0,
      underReview: false,
      language: 'uk',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  await closeDb();
}
