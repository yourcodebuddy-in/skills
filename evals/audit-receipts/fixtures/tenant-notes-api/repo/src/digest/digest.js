import { addDays, toIso, utcDay } from '../lib/time.js';
import { enqueueEmail } from '../mail/outbox.js';
import { digestEmail } from '../mail/templates.js';

export function enqueueDailyDigests(db, { now, publicUrl }) {
  const day = utcDay(now);
  const since = toIso(addDays(now, -1));

  const recipients = db
    .prepare('SELECT id, email, name FROM users WHERE digest_opt_in = 1 ORDER BY id')
    .all();
  const changedNotes = db.prepare(
    `SELECT n.id, n.title, n.team_id, t.name AS team_name
       FROM notes n
       JOIN teams t ON t.id = n.team_id
       JOIN memberships m ON m.team_id = n.team_id
      WHERE m.user_id = ? AND n.updated_at >= ?
      ORDER BY t.name COLLATE NOCASE, n.updated_at DESC`,
  );

  let queued = 0;
  for (const user of recipients) {
    const notes = changedNotes.all(user.id, since);
    if (notes.length === 0) {
      continue;
    }
    const message = digestEmail({ to: user.email, name: user.name, notes, publicUrl });
    if (enqueueEmail(db, message, { kind: 'digest', dedupeKey: `digest:${user.id}:${day}`, now })) {
      queued += 1;
    }
  }
  return queued;
}
