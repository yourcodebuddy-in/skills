import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { transaction } from "../src/database.js";
import { createStore, migrate, openDatabase } from "../src/index.js";
import { migrations } from "../src/migrations.js";

test("applies every migration once", () => {
  const db = openDatabase(":memory:");
  const applied = db.prepare("SELECT id FROM schema_migrations ORDER BY id").all().map((row) => row.id);
  assert.deepEqual(applied, migrations.map((migration) => migration.id));
  assert.deepEqual(migrate(db), []);
});

test("migrates a file database that already holds rows from an earlier version", () => {
  const dir = mkdtempSync(join(tmpdir(), "shop-db-"));
  try {
    const file = join(dir, "shop.db");
    const early = new DatabaseSync(file);
    early.exec("CREATE TABLE schema_migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)");
    for (const migration of migrations.slice(0, 7)) {
      early.exec(migration.sql);
      early.prepare("INSERT INTO schema_migrations VALUES (?, ?, ?)").run(migration.id, migration.name, "2026-01-01T00:00:00Z");
    }
    early.exec("INSERT INTO coupons (code, percent_off, created_at) VALUES ('OLD', 10, '2026-01-01T00:00:00Z')");
    early.close();

    const store = createStore(openDatabase(file));
    assert.equal(store.coupons.find("OLD").minSubtotalCents, 0);
    store.db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("rolls back a transaction that throws", () => {
  const store = createStore(openDatabase(":memory:"));
  assert.throws(() =>
    store.transaction(() => {
      store.products.create({ sku: "TMP-1", name: "Temp", priceCents: 100, stock: 1 }, "2026-01-01T00:00:00Z");
      throw new Error("stop");
    }),
  );
  assert.equal(store.products.list().total, 0);
});

test("refuses asynchronous work inside a transaction", () => {
  const db = openDatabase(":memory:");
  assert.throws(() => transaction(db, async () => {}), /synchronous/);
});
