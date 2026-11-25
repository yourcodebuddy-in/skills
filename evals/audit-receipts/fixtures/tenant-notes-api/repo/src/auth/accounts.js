import { isUniqueViolation } from '../db/transaction.js';
import { conflict } from '../http/errors.js';
import { newId } from '../lib/ids.js';
import { toIso } from '../lib/time.js';
import { hashPassword, verifyAgainstPlaceholder, verifyPassword } from './passwords.js';

export const findUserByEmail = (db, email) =>
  db.prepare('SELECT id, email, name FROM users WHERE email = ?').get(email) ?? null;

export async function registerUser(db, { email, name, password, now }) {
  if (findUserByEmail(db, email)) {
    throw conflict('An account with that email already exists');
  }
  const passwordHash = await hashPassword(password);
  const id = newId();
  try {
    db.prepare(
      'INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)',
    ).run(id, email, name, passwordHash, toIso(now));
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflict('An account with that email already exists');
    }
    throw error;
  }
  return { id, email, name };
}

export async function authenticate(db, { email, password }) {
  const row = db
    .prepare('SELECT id, email, name, password_hash FROM users WHERE email = ?')
    .get(email);
  if (!row) {
    await verifyAgainstPlaceholder(password);
    return null;
  }
  if (!(await verifyPassword(password, row.password_hash))) {
    return null;
  }
  return { id: row.id, email: row.email, name: row.name };
}

export function setDigestPreference(db, userId, enabled) {
  db.prepare('UPDATE users SET digest_opt_in = ? WHERE id = ?').run(enabled ? 1 : 0, userId);
}
