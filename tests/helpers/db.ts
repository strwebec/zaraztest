import { MongoClient, type Db } from 'mongodb';

// Local dev-only mongodb-memory-server instance (see backend/scripts/memory-mongo.js).
// No auth, no real credentials — safe to hardcode for local E2E runs.
const MONGO_URI = 'mongodb://127.0.0.1:27117/zaraz-dev?replicaSet=rs0';

let client: MongoClient | null = null;

export async function getDb(): Promise<Db> {
  if (!client) {
    client = new MongoClient(MONGO_URI);
    await client.connect();
  }
  return client.db();
}

export async function closeDb(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
  }
}

/** Removes every document created by the E2E suite, identified by the TEST_ prefix convention. */
export async function cleanupTestData(): Promise<void> {
  const db = await getDb();

  const testUsers = await db
    .collection('users')
    .find({ email: { $regex: /^test_/i } })
    .project({ _id: 1 })
    .toArray();
  const testUserIds = testUsers.map((u) => u._id);

  const testBusinesses = await db
    .collection('businesses')
    .find({ name: { $regex: /^TEST_/ } })
    .project({ _id: 1 })
    .toArray();
  const testBusinessIds = testBusinesses.map((b) => b._id);

  await Promise.all([
    // Manual bookings (created via the business calendar's "+ Додати запис")
    // have no `client` ref at all, only a free-text clientName — so they must
    // also be matched by that name prefix, or ones created against a
    // persistent seed business (e.g. MedCenter) leak past both other clauses.
    db.collection('bookings').deleteMany({
      $or: [
        { business: { $in: testBusinessIds } },
        { client: { $in: testUserIds } },
        { clientName: { $regex: /^TEST_/ } },
      ],
    }),
    db.collection('services').deleteMany({ business: { $in: testBusinessIds } }),
    db.collection('staff').deleteMany({ business: { $in: testBusinessIds } }),
    db.collection('reviews').deleteMany({ business: { $in: testBusinessIds } }),
    db.collection('notifications').deleteMany({ user: { $in: testUserIds } }),
    db.collection('invoices').deleteMany({ business: { $in: testBusinessIds } }),
  ]);

  await db.collection('businesses').deleteMany({ _id: { $in: testBusinessIds } });
  await db.collection('users').deleteMany({ _id: { $in: testUserIds } });
}

/**
 * The cancellation-penalty suite intentionally drives the real MedCenter seed
 * business through `unfairCancellations`/`warnings` increments (it needs a
 * real, bookable business — a fresh TEST_ business would need its own
 * approval + staff + services just to be booked once). Reset those counters
 * back to 0 afterwards so repeated suite runs don't visibly pollute demo data
 * an admin might be looking at.
 */
export async function resetPersistentFixtureCounters(): Promise<void> {
  const db = await getDb();
  await db
    .collection('businesses')
    .updateMany(
      { name: { $in: ['МедЦентр Стрий', 'Стрижка+', 'Bellissima'] } },
      { $set: { unfairCancellations: 0, warnings: 0, catalogPenaltyUntil: null, underReview: false } }
    );
}

/** Direct-write helper for state a UI flow can't reach in one step (e.g. backdating a booking). */
export async function updateDoc(
  collection: string,
  filter: Record<string, unknown>,
  update: Record<string, unknown>
): Promise<void> {
  const db = await getDb();
  await db.collection(collection).updateOne(filter, update);
}

export async function findOne<T = Record<string, unknown>>(
  collection: string,
  filter: Record<string, unknown>
): Promise<T | null> {
  const db = await getDb();
  return db.collection(collection).findOne(filter) as Promise<T | null>;
}
