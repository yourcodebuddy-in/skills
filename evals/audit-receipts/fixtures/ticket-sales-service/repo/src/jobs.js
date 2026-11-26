// A small durable job queue in the jobs table. The worker claims due jobs one at a time.

const MAX_ATTEMPTS = 5;
const BACKOFF_SECONDS = [30, 120, 600, 1800];

export function enqueueJob(db, kind, payload, now = new Date()) {
  const stamp = now.toISOString();
  const { lastInsertRowid } = db
    .prepare('INSERT INTO jobs (kind, payload, status, run_after, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(kind, JSON.stringify(payload), 'pending', stamp, stamp);
  return Number(lastInsertRowid);
}

export function claimNextJob(db, now = new Date()) {
  const stamp = now.toISOString();
  for (;;) {
    const job = db
      .prepare("SELECT * FROM jobs WHERE status = 'pending' AND run_after <= ? ORDER BY run_after, id LIMIT 1")
      .get(stamp);
    if (!job) return null;
    const { changes } = db
      .prepare("UPDATE jobs SET status = 'running', attempts = attempts + 1 WHERE id = ? AND status = 'pending'")
      .run(job.id);
    if (changes === 1) return { ...job, attempts: job.attempts + 1, payload: JSON.parse(job.payload) };
  }
}

export function completeJob(db, id, now = new Date()) {
  db.prepare("UPDATE jobs SET status = 'done', finished_at = ?, last_error = NULL WHERE id = ?").run(
    now.toISOString(),
    id,
  );
}

export function failJob(db, job, error, now = new Date()) {
  if (job.attempts >= MAX_ATTEMPTS) {
    db.prepare("UPDATE jobs SET status = 'failed', last_error = ?, finished_at = ? WHERE id = ?").run(
      error.message,
      now.toISOString(),
      job.id,
    );
    return 'failed';
  }
  const delay = BACKOFF_SECONDS[Math.min(job.attempts - 1, BACKOFF_SECONDS.length - 1)];
  const runAfter = new Date(now.getTime() + delay * 1000).toISOString();
  db.prepare("UPDATE jobs SET status = 'pending', last_error = ?, run_after = ? WHERE id = ?").run(
    error.message,
    runAfter,
    job.id,
  );
  return 'retry';
}

export function jobCounts(db) {
  return db.prepare('SELECT status, COUNT(*) AS n FROM jobs GROUP BY status').all();
}
