import { cleanupTestData, resetPersistentFixtureCounters, closeDb } from './helpers/db';

export default async function globalTeardown() {
  await cleanupTestData();
  await resetPersistentFixtureCounters();
  await closeDb();
}
