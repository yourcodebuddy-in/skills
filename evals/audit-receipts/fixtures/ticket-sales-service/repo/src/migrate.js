import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transaction } from './db.js';

const MIGRATIONS_DIR = fileURLToPath(new URL('../migrations', import.meta.url));

export function listMigrations(dir = MIGRATIONS_DIR) {
  return readdirSync(dir)
    .filter((name) => /^\d{3}_[a-z0-9_]+\.sql$/.test(name))
    .sort()
    .map((name) => ({ version: Number(name.slice(0, 3)), name, path: join(dir, name) }));
}

function appliedVersions(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL
  )`);
  return new Set(db.prepare('SELECT version FROM schema_migrations').all().map((row) => row.version));
}

// Applies every migration that hasn't run yet, each in its own transaction, and returns their names.
export function migrate(db, { dir = MIGRATIONS_DIR, now = () => new Date() } = {}) {
  const applied = appliedVersions(db);
  const ran = [];
  for (const migration of listMigrations(dir)) {
    if (applied.has(migration.version)) continue;
    const sql = readFileSync(migration.path, 'utf8');
    transaction(db, () => {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)').run(
        migration.version,
        migration.name,
        now().toISOString(),
      );
    });
    ran.push(migration.name);
  }
  return ran;
}

export function pendingMigrations(db, dir = MIGRATIONS_DIR) {
  const applied = appliedVersions(db);
  return listMigrations(dir).filter((migration) => !applied.has(migration.version));
}
