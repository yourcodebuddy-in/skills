import { SHARE_TTL_DAYS } from '../constants.js';
import { badRequest } from '../http/errors.js';
import { hashToken, newToken } from '../lib/ids.js';
import { addDays, toIso } from '../lib/time.js';

export function readExpiryDays(value) {
  if (value === undefined || value === null) {
    return SHARE_TTL_DAYS;
  }
  const days = Number(value);
  if (!Number.isInteger(days) || days < 1) {
    throw badRequest('expiresInDays must be a whole number of days');
  }
  return days;
}

export function createShareLink(db, { noteId, userId, days, now }) {
  const token = newToken();
  const expiresAt = toIso(addDays(now, days));
  const result = db
    .prepare(
      `INSERT INTO share_links (token_hash, note_id, created_by, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(hashToken(token), noteId, userId, toIso(now), expiresAt);
  return { id: Number(result.lastInsertRowid), token, expiresAt };
}

export const listShareLinks = (db, noteId) =>
  db
    .prepare(
      `SELECT id, created_by AS createdBy, created_at AS createdAt,
              expires_at AS expiresAt, revoked_at AS revokedAt
         FROM share_links
        WHERE note_id = ?
        ORDER BY id DESC`,
    )
    .all(noteId);

export function revokeShareLink(db, { noteId, shareId, now }) {
  const result = db
    .prepare(
      'UPDATE share_links SET revoked_at = ? WHERE id = ? AND note_id = ? AND revoked_at IS NULL',
    )
    .run(toIso(now), shareId, noteId);
  return result.changes > 0;
}

export function findSharedNote(db, token, now) {
  const row = db
    .prepare(
      `SELECT n.title, n.body, n.updated_at, t.name AS team_name
         FROM share_links s
         JOIN notes n ON n.id = s.note_id
         JOIN teams t ON t.id = n.team_id
        WHERE s.token_hash = ?
          AND s.revoked_at IS NULL
          AND s.expires_at > ?`,
    )
    .get(hashToken(token), now.getTime());
  return row ?? null;
}
