import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { migrate } from './migrations.js';

export function openDatabase(path) {
  const inMemory = path === ':memory:';
  if (!inMemory) {
    mkdirSync(dirname(path), { recursive: true });
  }

  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  if (!inMemory) {
    db.exec('PRAGMA journal_mode = WAL');
  }

  migrate(db);
  return db;
}
