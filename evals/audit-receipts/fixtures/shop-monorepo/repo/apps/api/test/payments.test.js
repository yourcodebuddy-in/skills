import assert from "node:assert/strict";
import test from "node:test";
import { signatureHeader } from "../../../packages/payments/src/index.js";
import { silentLogger } from "../src/logger.js";
import { startWorker } from "../src/worker.js";
import { WEBHOOK_SECRET, checkout, createTestApp } from "./helpers.js";

const pay = (t, cookie, intentId) => t.request({ method: "POST", path: `/api/dev/payments/${intentId}/pay`, cookie });

test("marks the order paid and queues a confirmation when the payment succeeds", async () => {
  const t = createTestApp();
  const product = t.addProduct();
  const { cookie } = await t.signUp();
  const { order, payment } = await checkout(t, cookie, [{ productId: product.id }]);

  const paid = await pay(t, cookie, payment.intentId);
  assert.equal(paid.status, 200);
  assert.equal(paid.body.order.status, "paid");
  assert.equal(t.deliveries.length, 1);

  const stored = t.store.orders.findByNumber(order.number);
  assert.ok(stored.paidAt);
  assert.equal(t.store.payments.findForOrder(stored.id).amountCents, order.totalCents);
  assert.deepEqual(
    t.store.outbox.pending().map((message) => message.kind),
    ["order_confirmation"],
  );
});

test("leaves the order unpaid when the card is declined", async () => {
  const t = createTestApp();
  const product = t.addProduct();
  const { cookie } = await t.signUp();
  const { order, payment } = await checkout(t, cookie, [{ productId: product.id }]);
  await t.request({ method: "POST", path: `/api/dev/payments/${payment.intentId}/decline`, cookie });
  assert.equal(t.store.orders.findByNumber(order.number).status, "pending_payment");
});

test("rejects a webhook with a bad signature", async () => {
  const t = createTestApp();
  const body = JSON.stringify({ id: "evt_x", type: "payment.succeeded", created: 0, data: {} });
  const now = Math.floor(Date.now() / 1000);
  const response = await t.request({
    method: "POST",
    path: "/api/webhooks/payments",
    body,
    headers: { "fakepay-signature": signatureHeader("whsec_wrong", now, body) },
  });
  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, "invalid_signature");
});

test("refuses a payment for a different amount than the order", async () => {
  const t = createTestApp();
  const product = t.addProduct();
  const { cookie } = await t.signUp();
  const { order, payment } = await checkout(t, cookie, [{ productId: product.id }]);
  const now = Math.floor(Date.now() / 1000);
  const body = JSON.stringify({
    id: "evt_short",
    type: "payment.succeeded",
    created: now,
    data: { intent_id: payment.intentId, charge_id: "ch_short", amount: 1 },
  });
  const response = await t.request({
    method: "POST",
    path: "/api/webhooks/payments",
    body,
    headers: { "fakepay-signature": signatureHeader(WEBHOOK_SECRET, now, body) },
  });
  assert.equal(response.status, 409);
  assert.equal(t.store.orders.findByNumber(order.number).status, "pending_payment");
});

test("only the shopper who placed the order can use its payment page", async () => {
  const t = createTestApp();
  const product = t.addProduct();
  const owner = await t.signUp({ email: "owner@example.com" });
  const other = await t.signUp({ email: "other@example.com" });
  const { payment } = await checkout(t, owner.cookie, [{ productId: product.id }]);
  assert.equal((await pay(t, other.cookie, payment.intentId)).status, 404);
});

test("cancels an order left unpaid and gives its stock back", async () => {
  let clock = new Date("2026-11-03T12:00:00Z");
  const t = createTestApp({ now: () => clock });
  const product = t.addProduct({ stock: 3 });
  const { cookie } = await t.signUp();
  const { order } = await checkout(t, cookie, [{ productId: product.id }]);
  const worker = startWorker({ store: t.store, payments: t.payments, logger: silentLogger, send: async () => {}, intervalMs: 60_000, now: () => clock });

  clock = new Date("2026-11-03T12:20:00Z");
  await worker.tick();
  assert.equal(t.store.orders.findByNumber(order.number).status, "pending_payment");

  clock = new Date("2026-11-03T12:45:00Z");
  await worker.tick();
  worker.stop();
  assert.equal(t.store.orders.findByNumber(order.number).status, "cancelled");
  assert.equal(t.store.products.find(product.id).stock, 3);
});
