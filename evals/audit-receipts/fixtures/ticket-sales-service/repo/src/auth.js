import { timingSafeEqual } from 'node:crypto';
import { HttpError } from './http/errors.js';
import { hashSecret } from './services/tenants.js';

const KEY_FORMAT = /^bo_([0-9a-f]{8})_([A-Za-z0-9_-]{20,64})$/;

function parseBearer(header) {
  if (typeof header !== 'string') return null;
  const [scheme, value] = header.split(' ');
  if (scheme !== 'Bearer' || !value) return null;
  const match = KEY_FORMAT.exec(value);
  return match ? { prefix: match[1], secret: match[2] } : null;
}

// Resolves an organiser API key to its tenant, or throws 401.
export function authenticate(db, headers, now = new Date()) {
  const parsed = parseBearer(headers.authorization);
  if (!parsed) throw new HttpError(401, 'unauthorized');

  const key = db
    .prepare('SELECT id, tenant_id, secret_hash FROM api_keys WHERE prefix = ? AND revoked_at IS NULL')
    .get(parsed.prefix);
  if (!key) throw new HttpError(401, 'unauthorized');

  const expected = Buffer.from(key.secret_hash, 'hex');
  const actual = Buffer.from(hashSecret(parsed.secret), 'hex');
  if (!timingSafeEqual(expected, actual)) throw new HttpError(401, 'unauthorized');

  db.prepare('UPDATE api_keys SET last_used_at = ? WHERE id = ?').run(now.toISOString(), key.id);
  return db.prepare('SELECT * FROM tenants WHERE id = ?').get(key.tenant_id);
}
