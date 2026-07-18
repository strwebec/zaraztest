// Local dev only: runs a real MongoDB replica-set (needed for transactions) in-process,
// with no MongoDB install required. Data persists in ./.data/mongo between restarts.
// Run once in its own terminal (`npm run db`), then `npm run seed` and `npm run dev` elsewhere.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

const PORT = 27117;
const REPL_SET_NAME = 'rs0';
const DB_PATH = path.join(__dirname, '..', '.data', 'mongo');

async function main() {
  fs.mkdirSync(DB_PATH, { recursive: true });
  const replSet = await MongoMemoryReplSet.create({
    replSet: { name: REPL_SET_NAME, count: 1, storageEngine: 'wiredTiger' },
    instanceOpts: [{ port: PORT, dbPath: DB_PATH, storageEngine: 'wiredTiger' }],
  });

  const uri = `mongodb://127.0.0.1:${PORT}/zaraz-dev?replicaSet=${REPL_SET_NAME}`;
  console.log('[memory-mongo] running at', uri);
  console.log('[memory-mongo] set MONGODB_URI to this value in backend/.env (already set by default)');
  console.log('[memory-mongo] press Ctrl+C to stop');

  process.on('SIGINT', async () => {
    await replSet.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('[memory-mongo] failed to start', err);
  process.exit(1);
});
