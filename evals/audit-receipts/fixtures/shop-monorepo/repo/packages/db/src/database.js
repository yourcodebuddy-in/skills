import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { migrations } from "./migrations.js";

const IN_MEMORY = ":memory:";

// One connection per process. node:sqlite is synchronous, so a transaction runs start to finish
// without another request's statements landing in the middle (docs/adr/0003-sqlite-through-node-sqlite.md).
export const transaction = (db, work) => {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = work();
    if (result && typeof result.then === "function") {
      throw new TypeError("A transaction's work must be synchronous");
    }
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
};

export const migrate = (db, { now = () => new Date() } = {}) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `);
  const applied = new Set(db.prepare("SELECT id FROM schema_migrations").all().map((row) => row.id));
  const record = db.prepare("INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?)");
  const ran = [];
  for (const migration of migrations) {
    if (applied.has(migration.id)) {
      continue;
    }
    transaction(db, () => {
      db.exec(migration.sql);
      record.run(migration.id, migration.name, now().toISOString());
    });
    ran.push(migration.name);
  }
  return ran;
};

export const openDatabase = (filename = IN_MEMORY) => {
  if (filename !== IN_MEMORY) {
    mkdirSync(dirname(filename), { recursive: true });
  }
  const db = new DatabaseSync(filename);
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 5000");
  if (filename !== IN_MEMORY) {
    db.exec("PRAGMA journal_mode = WAL");
  }
  migrate(db);
  return db;
};
