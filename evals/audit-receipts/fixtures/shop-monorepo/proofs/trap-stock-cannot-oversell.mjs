// README: two shoppers racing for the last unit get one order and one 409, so stock is never oversold.
// True: checkout takes stock with a conditional UPDATE inside a BEGIN IMMEDIATE transaction.
// Run from the root of a copy of repo/.
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const load = (path) => import(pathToFileURL(join(root, path)).href);
const { createTestApp, SHIPPING } = await load("apps/api/test/helpers.js");
const { createStore, openDatabase } = await load("packages/db/src/index.js");

const claimed = readFileSync(join(root, "README.md"), "utf8").replace(/\s+/g, " ").includes("one order goes through and the other gets `409 out_of_stock`");

// 1. Through the API, many shoppers checking out at once for one unit.
const t = createTestApp();
const product = t.addProduct({ stock: 1 });
const shoppers = [];
for (let index = 0; index < 8; index += 1) {
  const shopper = await t.signUp({ email: `s${index}@example.com` });
  await t.request({ method: "POST", path: "/api/cart/items", cookie: shopper.cookie, body: { productId: product.id } });
  shoppers.push(shopper);
}
const results = await Promise.all(
  shoppers.map((shopper) => t.request({ method: "POST", path: "/api/checkout", cookie: shopper.cookie, body: { shipping: SHIPPING } })),
);
const placed = results.filter((result) => result.status === 201).length;
const refused = results.filter((result) => result.status === 409 && result.body.error.code === "out_of_stock").length;
const stockLeft = t.store.products.find(product.id).stock;
console.log("API race: placed", placed, "refused", refused, "stock left", stockLeft);

// 2. Two separate connections to one database file, as two processes would have.
const dir = mkdtempSync(join(tmpdir(), "stock-proof-"));
let separateOk = false;
try {
  const file = join(dir, "shop.db");
  const a = createStore(openDatabase(file));
  a.products.create({ sku: "LAST-ONE", name: "Last one", priceCents: 100, stock: 1 }, new Date().toISOString());
  const b = createStore(openDatabase(file));
  const raw = new DatabaseSync(file);
  raw.exec("PRAGMA busy_timeout = 0");
  a.db.exec("BEGIN IMMEDIATE");
  const tookA = a.products.takeStock(1, 1);
  let blocked = false;
  try {
    raw.exec("BEGIN IMMEDIATE");
  } catch {
    blocked = true;
  }
  a.db.exec("COMMIT");
  const tookB = b.transaction(() => b.products.takeStock(1, 1));
  separateOk = tookA && blocked && !tookB && b.products.find(1).stock === 0;
  console.log("two connections: first took", tookA, "| second writer blocked mid-transaction", blocked, "| second took", tookB);
  raw.close();
  a.db.close();
  b.db.close();
} finally {
  rmSync(dir, { recursive: true, force: true });
}

process.exit(claimed && placed === 1 && refused === 7 && stockLeft === 0 && separateOk ? 0 : 1);
