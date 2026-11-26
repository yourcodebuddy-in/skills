import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openDatabase } from '../src/db.js';
import { listMigrations, migrate, pendingMigrations } from '../src/migrate.js';

test('migrations run in order and are recorded', () => {
  const db = openDatabase(':memory:');
  const ran = migrate(db);
  assert.deepEqual(
    ran,
    listMigrations().map((migration) => migration.name),
  );
  assert.equal(pendingMigrations(db).length, 0);
  assert.deepEqual(migrate(db), []);
});

test('the schema enforces one order per hold', () => {
  const db = openDatabase(':memory:');
  migrate(db);
  const index = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'orders'")
    .get();
  assert.match(index.sql, /hold_id INTEGER NOT NULL UNIQUE/);
});
