import assert from "node:assert/strict";
import test from "node:test";
import { createStore, openDatabase } from "../src/index.js";

const seed = () => {
  const store = createStore(openDatabase(":memory:"));
  const rows = [
    ["MUG-STONE", "Stoneware mug", 1800, 3, "2026-01-01"],
    ["MUG-TALL", "Tall mug", 2200, 0, "2026-01-02"],
    ["FILTERS-100", "Paper filters 100% unbleached", 650, 50, "2026-01-03"],
    ["KETTLE", "Gooseneck kettle", 5600, 2, "2026-01-04"],
  ];
  for (const [sku, name, priceCents, stock, day] of rows) {
    store.products.create({ sku, name, priceCents, stock }, `${day}T00:00:00.000Z`);
  }
  store.products.update(4, { active: false }, "2026-01-05T00:00:00.000Z");
  return store;
};

test("lists listed products newest first by default", () => {
  const { items, total } = seed().products.list();
  assert.equal(total, 3);
  assert.deepEqual(
    items.map((product) => product.sku),
    ["FILTERS-100", "MUG-TALL", "MUG-STONE"],
  );
});

test("sorts by price and by name", () => {
  const store = seed();
  assert.deepEqual(
    store.products.list({ sort: "price_asc" }).items.map((product) => product.priceCents),
    [650, 1800, 2200],
  );
  assert.deepEqual(
    store.products.list({ sort: "name" }).items.map((product) => product.name),
    ["Paper filters 100% unbleached", "Stoneware mug", "Tall mug"],
  );
});

test("falls back to newest for a sort it doesn't know", () => {
  const store = seed();
  assert.deepEqual(store.products.list({ sort: "popularity" }).items, store.products.list().items);
});

test("searches names, treating % and _ as plain characters", () => {
  const store = seed();
  assert.equal(store.products.list({ search: "mug" }).total, 2);
  assert.equal(store.products.list({ search: "100%" }).total, 1);
  assert.equal(store.products.list({ search: "%" }).total, 1);
});

test("takes stock only when there is enough", () => {
  const store = seed();
  assert.equal(store.products.takeStock(1, 2), true);
  assert.equal(store.products.takeStock(1, 2), false);
  assert.equal(store.products.find(1).stock, 1);
  store.products.restoreStock(1, 2);
  assert.equal(store.products.find(1).stock, 3);
});
