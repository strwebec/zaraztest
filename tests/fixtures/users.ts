/**
 * Known-good accounts used across the suite.
 *
 * `superAdmin` and `businessOwner` are pre-existing seed accounts from
 * backend/seed/seed.js and backend/seed/demoBusinesses.js — verified live against
 * the running dev DB. They are NOT prefixed with TEST_/test_ and must never be
 * deleted by cleanup.
 *
 * `moderator` and `financeAdmin` don't exist in seed data (no self-registration
 * path for admin sub-roles — they're normally created via the admin "Team" invite
 * flow) — tests/global-setup.ts inserts them directly into the DB before the run.
 *
 * `client` fixtures are template data for dynamically registering a fresh CLIENT
 * per test via the real UI (see helpers/auth.ts registerClient) — every generated
 * email is prefixed test_ so global-teardown can find and remove it.
 */
export const TEST_USERS = {
  superAdmin: {
    role: 'SUPER_ADMIN' as const,
    email: 'admin@zaraz.ua',
    password: 'SuperAdmin123!',
  },
  businessOwner: {
    role: 'BUSINESS_OWNER' as const,
    email: 'medcenter@example.com',
    password: 'DemoOwner123!',
    businessName: 'МедЦентр Стрий',
  },
  moderator: {
    role: 'MODERATOR' as const,
    name: 'Test Moderator',
    email: 'test_moderator@example.com',
    password: 'TestModerator123!',
  },
  financeAdmin: {
    role: 'FINANCE_ADMIN' as const,
    name: 'Test Finance Admin',
    email: 'test_finance@example.com',
    password: 'TestFinance123!',
  },
};

export function uniqueTestEmail(label: string) {
  return `test_${label}_${Date.now()}_${Math.floor(Math.random() * 10000)}@example.com`;
}
