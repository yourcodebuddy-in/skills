// products.list builds ORDER BY with a template literal, but only from a frozen allow-list looked up
// with Object.hasOwn; every other value of the sort parameter falls back to "newest". Search text
// is bound as a parameter. Run from the root of a copy of repo/.
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const load = (path) => import(pathToFileURL(join(root, path)).href);
const { createStore, openDatabase } = await load("packages/db/src/index.js");
const { createTestApp } = await load("apps/api/test/helpers.js");

const ALLOWED = new Set([
  "created_at DESC, id DESC",
  "price_cents ASC, id ASC",
  "price_cents DESC, id DESC",
  "name COLLATE NOCASE ASC, id ASC",
]);

const db = openDatabase(":memory:");
const statements = [];
const prepare = db.prepare.bind(db);
db.prepare = (sql) => {
  statements.push(sql);
  return prepare(sql);
};
const store = createStore(db);
store.products.create({ sku: "MUG-1", name: "Mug", priceCents: 100, stock: 1 }, "2026-01-01T00:00:00Z");

const inputs = [
  "newest", "price_asc", "price_desc", "name", undefined, null, "", "NAME", "name ",
  "__proto__", "constructor", "toString", "hasOwnProperty", "valueOf", "isPrototypeOf",
  "id; DROP TABLE products; --", "price_cents DESC, (SELECT password_hash FROM users)", "1", 1, ["name"], { toString: () => "name" },
];
let ok = true;
for (const sort of inputs) {
  statements.length = 0;
  for (const search of [null, "Mug", "%' OR 1=1 --"]) {
    store.products.list({ sort, search });
  }
  for (const sql of statements.filter((text) => text.includes("ORDER BY"))) {
    const clause = sql.match(/ORDER BY (.+) LIMIT \?/)[1];
    if (!ALLOWED.has(clause) || sql.includes("OR 1=1")) {
      ok = false;
      console.log("unexpected SQL for", sort, ":", sql);
    }
  }
}

const t = createTestApp();
t.addProduct();
const response = await t.request({ path: `/api/products?sort=${encodeURIComponent("price_cents; DROP TABLE products --")}&q=${encodeURIComponent("' OR '1'='1")}` });
const stillThere = t.store.products.list().total === 1;
console.log("every ORDER BY came from the allow-list:", ok, "| hostile query status", response.status, "| table intact", stillThere);
process.exit(ok && response.status === 200 && stillThere ? 0 : 1);
