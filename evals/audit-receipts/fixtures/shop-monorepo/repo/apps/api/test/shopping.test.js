import assert from "node:assert/strict";
import test from "node:test";
import { SHIPPING, checkout, createTestApp } from "./helpers.js";

test("lists products and hides unlisted ones", async () => {
  const t = createTestApp();
  t.addProduct();
  t.addProduct({ sku: "MUG-TALL", name: "Tall mug", active: false });
  const response = await t.request({ path: "/api/products" });
  assert.equal(response.status, 200);
  assert.deepEqual(
    response.body.items.map((product) => product.sku),
    ["MUG-STONE"],
  );
  assert.equal(response.body.items[0].stock, undefined, "stock levels stay private");
});

test("builds a cart and changes it", async () => {
  const t = createTestApp();
  const product = t.addProduct();
  const { cookie } = await t.signUp();

  const added = await t.request({ method: "POST", path: "/api/cart/items", cookie, body: { productId: product.id, quantity: 2 } });
  assert.equal(added.status, 201);
  assert.equal(added.body.cart.subtotalCents, 3600);

  const changed = await t.request({ method: "PATCH", path: `/api/cart/items/${product.id}`, cookie, body: { quantity: 3 } });
  assert.equal(changed.body.cart.itemCount, 3);

  const tooMany = await t.request({ method: "PATCH", path: `/api/cart/items/${product.id}`, cookie, body: { quantity: 11 } });
  assert.equal(tooMany.status, 400);

  const removed = await t.request({ method: "DELETE", path: `/api/cart/items/${product.id}`, cookie });
  assert.equal(removed.body.cart.items.length, 0);
});

test("checks out, takes stock and empties the cart", async () => {
  const t = createTestApp();
  const product = t.addProduct({ stock: 5 });
  const { cookie } = await t.signUp();
  const { order, payment } = await checkout(t, cookie, [{ productId: product.id, quantity: 2 }], { note: "Leave by the door" });

  assert.equal(order.status, "pending_payment");
  assert.equal(order.totalCents, 3600 + 599 + 297);
  assert.equal(order.note, "Leave by the door");
  assert.match(payment.intentId, /^pi_/);
  assert.equal(t.store.products.find(product.id).stock, 3);
  assert.equal((await t.request({ path: "/api/cart", cookie })).body.cart.items.length, 0);
});

test("applies a coupon at checkout and counts the use", async () => {
  const t = createTestApp();
  const product = t.addProduct({ priceCents: 4000 });
  t.store.coupons.create(
    { code: "TENOFF", percentOff: 10, amountOffCents: null, minSubtotalCents: 0, maxRedemptions: 1, expiresOn: null },
    new Date().toISOString(),
  );
  const { cookie } = await t.signUp();
  await t.request({ method: "POST", path: "/api/cart/items", cookie, body: { productId: product.id, quantity: 1 } });
  const quoted = await t.request({ method: "POST", path: "/api/checkout/quote", cookie, body: { couponCode: "tenoff" } });
  assert.equal(quoted.body.quote.discountCents, 400);

  const placed = await t.request({ method: "POST", path: "/api/checkout", cookie, body: { shipping: SHIPPING, couponCode: "TENOFF" } });
  assert.equal(placed.status, 201);
  assert.equal(placed.body.order.discountCents, 400);
  assert.equal(t.store.coupons.find("TENOFF").redemptions, 1);
});

test("refuses checkout when stock ran out after the item was added", async () => {
  const t = createTestApp();
  const product = t.addProduct({ stock: 1 });
  const first = await t.signUp({ email: "first@example.com" });
  const second = await t.signUp({ email: "second@example.com" });
  for (const shopper of [first, second]) {
    await t.request({ method: "POST", path: "/api/cart/items", cookie: shopper.cookie, body: { productId: product.id } });
  }
  await t.request({ method: "POST", path: "/api/checkout", cookie: first.cookie, body: { shipping: SHIPPING } });
  const late = await t.request({ method: "POST", path: "/api/checkout", cookie: second.cookie, body: { shipping: SHIPPING } });
  assert.equal(late.status, 409);
  assert.equal(late.body.error.code, "out_of_stock");
  assert.equal(t.store.products.find(product.id).stock, 0);
});

test("shows shoppers their own orders only", async () => {
  const t = createTestApp();
  const product = t.addProduct();
  const owner = await t.signUp({ email: "owner@example.com" });
  const other = await t.signUp({ email: "other@example.com" });
  const { order } = await checkout(t, owner.cookie, [{ productId: product.id }]);

  assert.equal((await t.request({ path: `/api/orders/${order.number}`, cookie: owner.cookie })).status, 200);
  assert.equal((await t.request({ path: `/api/orders/${order.number}`, cookie: other.cookie })).status, 404);
  assert.equal((await t.request({ path: "/api/orders", cookie: other.cookie })).body.items.length, 0);
});

test("lets a shopper cancel an unpaid order and puts the stock back", async () => {
  const t = createTestApp();
  const product = t.addProduct({ stock: 4 });
  const { cookie } = await t.signUp();
  const { order } = await checkout(t, cookie, [{ productId: product.id, quantity: 2 }]);
  const cancelled = await t.request({ method: "POST", path: `/api/orders/${order.number}/cancel`, cookie });
  assert.equal(cancelled.body.order.status, "cancelled");
  assert.equal(t.store.products.find(product.id).stock, 4);
});
