import { SESSION_COOKIE, parseCookies } from '../http/cookies.js';
import { hashToken, newToken } from '../lib/ids.js';
import { addDays, toIso } from '../lib/time.js';

export function createSession(db, userId, { now, days }) {
  const token = newToken();
  const expiresAt = addDays(now, days);
  db.prepare(
    'INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
  ).run(hashToken(token), userId, toIso(now), toIso(expiresAt));
  return { token, expiresAt };
}

export function findSessionUser(db, token, now) {
  if (!token) {
    return null;
  }
  const user = db
    .prepare(
      `SELECT u.id, u.email, u.name
         FROM sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .get(hashToken(token), toIso(now));
  return user ?? null;
}

export function endSession(db, token) {
  if (token) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
  }
}

export function tokenFromRequest(req) {
  const header = req.headers.authorization ?? '';
  if (header.startsWith('Bearer ')) {
    return header.slice('Bearer '.length).trim() || null;
  }
  return parseCookies(req.headers.cookie)[SESSION_COOKIE] || null;
}
