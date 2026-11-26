import { createHash } from 'node:crypto';
import { conflict, notFound } from '../http/errors.js';
import { apiKeyParts } from '../lib/ids.js';
import { requireSlug, requireTimeZone } from '../lib/validate.js';

export const hashSecret = (secret) => createHash('sha256').update(secret).digest('hex');

export function createTenant(db, { name, slug, timezone = 'UTC' }, now = new Date()) {
  requireSlug(slug);
  requireTimeZone(timezone);
  if (db.prepare('SELECT 1 FROM tenants WHERE slug = ?').get(slug)) throw conflict('slug_taken', { slug });
  const { lastInsertRowid } = db
    .prepare('INSERT INTO tenants (name, slug, timezone, created_at) VALUES (?, ?, ?, ?)')
    .run(name, slug, timezone, now.toISOString());
  return getTenant(db, Number(lastInsertRowid));
}

function getTenant(db, id) {
  return db.prepare('SELECT * FROM tenants WHERE id = ?').get(id);
}

export function getTenantBySlug(db, slug) {
  const tenant = db.prepare('SELECT * FROM tenants WHERE slug = ?').get(slug);
  if (!tenant) throw notFound('tenant_not_found');
  return tenant;
}

export function listTenants(db) {
  return db.prepare('SELECT * FROM tenants ORDER BY id').all();
}

// Returns the full key once. Only the prefix and a hash of the secret are stored.
export function createApiKey(db, tenantId, label = '', now = new Date()) {
  const { prefix, secret } = apiKeyParts();
  db.prepare(
    'INSERT INTO api_keys (tenant_id, prefix, secret_hash, label, created_at) VALUES (?, ?, ?, ?, ?)',
  ).run(tenantId, prefix, hashSecret(secret), label, now.toISOString());
  return { prefix, key: `bo_${prefix}_${secret}` };
}

export function revokeApiKey(db, prefix, now = new Date()) {
  const { changes } = db
    .prepare('UPDATE api_keys SET revoked_at = ? WHERE prefix = ? AND revoked_at IS NULL')
    .run(now.toISOString(), prefix);
  return changes === 1;
}

export function listApiKeys(db, tenantId) {
  return db
    .prepare('SELECT prefix, label, created_at, last_used_at, revoked_at FROM api_keys WHERE tenant_id = ? ORDER BY id')
    .all(tenantId);
}
