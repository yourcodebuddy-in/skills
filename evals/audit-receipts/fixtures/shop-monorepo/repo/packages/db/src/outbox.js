export const outboxRepo = (db) => ({
  enqueue: (kind, payload, createdAt) => {
    db.prepare("INSERT INTO outbox (kind, payload, created_at) VALUES (?, ?, ?)").run(kind, JSON.stringify(payload), createdAt);
  },

  pending: (limit = 20) =>
    db
      .prepare("SELECT id, kind, payload, attempts FROM outbox WHERE sent_at IS NULL AND attempts < 5 ORDER BY id LIMIT ?")
      .all(limit)
      .map((row) => ({ id: row.id, kind: row.kind, payload: JSON.parse(row.payload), attempts: row.attempts })),

  markSent: (id, at) => {
    db.prepare("UPDATE outbox SET sent_at = ?, attempts = attempts + 1 WHERE id = ?").run(at, id);
  },

  markFailed: (id) => {
    db.prepare("UPDATE outbox SET attempts = attempts + 1 WHERE id = ?").run(id);
  },
});
