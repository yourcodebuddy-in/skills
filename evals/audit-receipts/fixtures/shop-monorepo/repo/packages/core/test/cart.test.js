import assert from "node:assert/strict";
import test from "node:test";
import { planAddition, summarizeCart } from "../src/cart.js";

const product = { id: 7, active: true, stock: 5, priceCents: 1800 };

test("adds a new line", () => {
  assert.deepEqual(planAddition({ lines: [], product, quantity: 2 }), { productId: 7, quantity: 2 });
});

test("adds to the quantity of an existing line", () => {
  const lines = [{ productId: 7, quantity: 2 }];
  assert.deepEqual(planAddition({ lines, product, quantity: 1 }), { productId: 7, quantity: 3 });
});

test("refuses more than is in stock", () => {
  const lines = [{ productId: 7, quantity: 4 }];
  assert.throws(() => planAddition({ lines, product, quantity: 2 }), { code: "out_of_stock" });
});

test("refuses more than ten of one product", () => {
  const plenty = { ...product, stock: 100 };
  assert.throws(() => planAddition({ lines: [{ productId: 7, quantity: 9 }], product: plenty, quantity: 2 }), {
    code: "invalid_request",
  });
});

test("refuses a hidden or missing product", () => {
  assert.throws(() => planAddition({ lines: [], product: { ...product, active: false }, quantity: 1 }), { status: 404 });
  assert.throws(() => planAddition({ lines: [], product: undefined, quantity: 1 }), { status: 404 });
});

test("refuses a new line once the cart is full", () => {
  const lines = Array.from({ length: 30 }, (_, index) => ({ productId: 100 + index, quantity: 1 }));
  assert.throws(() => planAddition({ lines, product, quantity: 1 }), { code: "cart_full" });
});

test("summarizes lines and flags ones that can't be bought", () => {
  const summary = summarizeCart([
    { productId: 1, sku: "A", name: "A", quantity: 2, unitPriceCents: 500, stock: 5, active: true },
    { productId: 2, sku: "B", name: "B", quantity: 3, unitPriceCents: 100, stock: 1, active: true },
  ]);
  assert.equal(summary.itemCount, 5);
  assert.equal(summary.subtotalCents, 1300);
  assert.deepEqual(
    summary.items.map((item) => item.available),
    [true, false],
  );
});
