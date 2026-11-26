import { conflict } from '../http/errors.js';
import { enqueueMail } from '../mail/outbox.js';
import { escapeHtml } from '../mail/templates.js';
import { requireEmail, requireObject, requireString } from '../lib/validate.js';
import { seatsLeft } from './holds.js';

export function joinWaitlist(db, tierId, body, now = new Date()) {
  requireObject(body);
  const email = requireEmail(body, 'email');
  const name = requireString(body, 'name', { max: 120 });
  if (seatsLeft(db, tierId) > 0) throw conflict('seats_available');
  db.prepare(
    `INSERT INTO waitlist (tier_id, email, name, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (tier_id, email) DO NOTHING`,
  ).run(tierId, email, name, now.toISOString());
  return { tierId, email };
}

export function waitlistSize(db, tierId) {
  return db.prepare('SELECT COUNT(*) AS n FROM waitlist WHERE tier_id = ? AND notified_at IS NULL').get(tierId).n;
}

// Tells as many waiting buyers as there are free seats, oldest first.
export function notifyWaitlist(db, tierId, { eventTitle, link }, now = new Date()) {
  const free = seatsLeft(db, tierId);
  if (free <= 0) return 0;
  const waiting = db
    .prepare('SELECT * FROM waitlist WHERE tier_id = ? AND notified_at IS NULL ORDER BY id LIMIT ?')
    .all(tierId, free);
  for (const entry of waiting) {
    enqueueMail(
      db,
      {
        kind: 'waitlist',
        to: entry.email,
        subject: `Seats are available for ${eventTitle}`,
        text: `Hi ${entry.name},\n\nSeats have come up for ${eventTitle}. Book here: ${link}`,
        html: `<p>Hi ${escapeHtml(entry.name)},</p><p>Seats have come up for <strong>${escapeHtml(eventTitle)}</strong>. <a href="${escapeHtml(link)}">Book now</a>.</p>`,
      },
      now,
    );
    db.prepare('UPDATE waitlist SET notified_at = ? WHERE id = ?').run(now.toISOString(), entry.id);
  }
  return waiting.length;
}
