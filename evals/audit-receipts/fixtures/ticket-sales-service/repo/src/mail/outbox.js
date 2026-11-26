// Outgoing email is written to the outbox in the same transaction as the change that causes it, and
// the worker delivers it (ADR 0003).

const MAX_ATTEMPTS = 5;

export function enqueueMail(db, message, now = new Date()) {
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO outbox (kind, recipient, subject, text_body, html_body, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
    )
    .run(message.kind, message.to, message.subject, message.text, message.html, now.toISOString());
  return Number(lastInsertRowid);
}

export function pendingMail(db, limit) {
  return db.prepare("SELECT * FROM outbox WHERE status = 'pending' ORDER BY id LIMIT ?").all(limit);
}

export function markSent(db, id, now = new Date()) {
  db.prepare("UPDATE outbox SET status = 'sent', sent_at = ? WHERE id = ?").run(now.toISOString(), id);
}

export function recordMailError(db, id, message) {
  db.prepare(
    `UPDATE outbox SET attempts = attempts + 1, last_error = ?,
       status = CASE WHEN attempts + 1 >= ? THEN 'failed' ELSE status END
     WHERE id = ?`,
  ).run(message, MAX_ATTEMPTS, id);
}

// Puts failed messages back in the queue with a fresh attempt count. Returns how many.
export function retryFailedMail(db) {
  const { changes } = db
    .prepare("UPDATE outbox SET status = 'pending', attempts = 0 WHERE status = 'failed'")
    .run();
  return changes;
}

export function outboxCounts(db) {
  return db.prepare('SELECT status, COUNT(*) AS n FROM outbox GROUP BY status').all();
}
