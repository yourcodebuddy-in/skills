// Queues one digest email per opted-in user. The server's outbox worker sends them.
// Run once a day from cron, for example: 0 7 * * * cd /srv/tenant-notes && npm run digest
import { loadConfig } from '../src/config.js';
import { openDatabase } from '../src/db/database.js';
import { enqueueDailyDigests } from '../src/digest/digest.js';

const config = loadConfig();
const db = openDatabase(config.databasePath);

try {
  const queued = enqueueDailyDigests(db, { now: new Date(), publicUrl: config.publicUrl });
  console.info(`queued ${queued} digest email(s)`);
} finally {
  db.close();
}
