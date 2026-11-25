import assert from "node:assert/strict";
import test from "node:test";
import { checkout, createTestApp } from "./helpers.js";

const paidOrder = async (t) => {
  const product = t.addProduct({ priceCents: 2000 });
  const shopper = await t.signUp();
  const { order, payment } = await checkout(t, shopper.cookie, [{ productId: product.id }]);
  await t.request({ method: "POST", path: `/api/dev/payments/${payment.intentId}/pay`, cookie: shopper.cookie });
  return order;
};

test("lists orders for staff with a status filter", async () => {
  const t = createTestApp();
  const order = await paidOrder(t);
  const { cookie } = await t.signUp({ email: "staff@example.com", admin: true });
  const all = await t.request({ path: "/api/admin/orders", cookie });
  assert.equal(all.body.total, 1);
  assert.equal(all.body.items[0].customerEmail, "shopper@example.com");
  const pending = await t.request({ path: "/api/admin/orders?status=pending_payment", cookie });
  assert.equal(pending.body.total, 0);
  const detail = await t.request({ path: `/api/admin/orders/${order.number}`, cookie });
  assert.equal(detail.body.order.refundableCents, order.totalCents);
});

test("ships a paid order once", async () => {
  const t = createTestApp();
  const order = await paidOrder(t);
  const { cookie } = await t.signUp({ email: "staff@example.com", admin: true });
  const shipped = await t.request({ method: "POST", path: `/api/admin/orders/${order.number}/fulfil`, cookie });
  assert.equal(shipped.body.order.status, "fulfilled");
  const again = await t.request({ method: "POST", path: `/api/admin/orders/${order.number}/fulfil`, cookie });
  assert.equal(again.status, 409);
});

test("refunds in parts and marks the order refunded when nothing is left", async () => {
  const t = createTestApp();
  const order = await paidOrder(t);
  const { cookie } = await t.signUp({ email: "staff@example.com", admin: true });
  const path = `/api/admin/orders/${order.number}/refund`;

  const part = await t.request({ method: "POST", path, cookie, body: { amountCents: 1000 } });
  assert.equal(part.body.order.status, "paid");
  assert.equal(part.body.order.refundableCents, order.totalCents - 1000);
  assert.match(part.body.order.refunds[0].providerRefundId, /^re_/);

  const tooMuch = await t.request({ method: "POST", path, cookie, body: { amountCents: order.totalCents } });
  assert.equal(tooMuch.status, 409);

  const rest = await t.request({ method: "POST", path, cookie, body: { amountCents: order.totalCents - 1000 } });
  assert.equal(rest.body.order.status, "refunded");
});

test("creates and edits products", async () => {
  const t = createTestApp();
  const { cookie } = await t.signUp({ email: "staff@example.com", admin: true });
  const body = { sku: "scale-01", name: "Brew scale", priceCents: 3900, stock: 15 };
  const created = await t.request({ method: "POST", path: "/api/admin/products", cookie, body });
  assert.equal(created.status, 201);
  assert.equal(created.body.product.sku, "SCALE-01");

  const duplicate = await t.request({ method: "POST", path: "/api/admin/products", cookie, body });
  assert.equal(duplicate.status, 409);

  const edited = await t.request({
    method: "PATCH",
    path: `/api/admin/products/${created.body.product.id}`,
    cookie,
    body: { priceCents: 3500, active: false },
  });
  assert.equal(edited.body.product.priceCents, 3500);
  assert.equal(edited.body.product.active, false);
});

test("reports takings by day", async () => {
  const t = createTestApp();
  const order = await paidOrder(t);
  const { cookie } = await t.signUp({ email: "staff@example.com", admin: true });
  const today = new Date().toISOString().slice(0, 10);
  const report = await t.request({ path: `/api/admin/reports/sales?from=${today}&to=${today}`, cookie });
  assert.equal(report.status, 200);
  assert.equal(report.body.paidCents, order.totalCents);
  assert.equal(report.body.days.length, 1);
});
