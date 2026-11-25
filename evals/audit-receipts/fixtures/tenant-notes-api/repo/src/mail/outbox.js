import { OUTBOX_BATCH, OUTBOX_INTERVAL_MS, OUTBOX_MAX_ATTEMPTS } from '../constants.js';
import { toIso } from '../lib/time.js';

export function enqueueEmail(db, message, { kind, dedupeKey = null, now }) {
  const result = db
    .prepare(
      `INSERT INTO outbox (kind, recipient, subject, body, dedupe_key, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (dedupe_key) DO NOTHING`,
    )
    .run(kind, message.to, message.subject, message.text, dedupeKey, toIso(now));
  return result.changes > 0;
}

export async function deliverPending(db, mailer, { now = new Date(), limit = OUTBOX_BATCH } = {}) {
  const rows = db
    .prepare(
      `SELECT id, recipient, subject, body
         FROM outbox
        WHERE sent_at IS NULL AND attempts < ?
        ORDER BY id
        LIMIT ?`,
    )
    .all(OUTBOX_MAX_ATTEMPTS, limit);
  if (rows.length === 0) {
    return 0;
  }

  for (const row of rows) {
    try {
      await mailer.send({ to: row.recipient, subject: row.subject, text: row.body });
    } catch (error) {
      db.prepare('UPDATE outbox SET attempts = attempts + 1, last_error = ? WHERE id = ?').run(
        error.message,
        row.id,
      );
      throw error;
    }
  }

  const ids = rows.map((row) => row.id);
  db.prepare(
    `UPDATE outbox SET sent_at = ?, attempts = attempts + 1
      WHERE id IN (${ids.map(() => '?').join(', ')})`,
  ).run(toIso(now), ...ids);
  return rows.length;
}

export function startOutboxWorker({ db, mailer, clock, log, intervalMs = OUTBOX_INTERVAL_MS }) {
  let busy = false;
  const tick = async () => {
    if (busy) {
      return;
    }
    busy = true;
    try {
      const sent = await deliverPending(db, mailer, { now: clock() });
      if (sent > 0) {
        log.info(`outbox: delivered ${sent}`);
      }
    } catch (error) {
      log.error(`outbox: delivery stopped: ${error.message}`);
    } finally {
      busy = false;
    }
  };
  const timer = setInterval(tick, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
