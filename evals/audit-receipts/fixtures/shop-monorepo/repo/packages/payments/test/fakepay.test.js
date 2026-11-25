import assert from "node:assert/strict";
import test from "node:test";
import { ProviderError, createPaymentProvider, verifyWebhook } from "../src/index.js";

const secret = "whsec_fake";

const provider = () => {
  const sent = [];
  const fakepay = createPaymentProvider("fakepay", {
    webhookSecret: secret,
    deliver: async (delivery) => {
      sent.push(delivery);
      return true;
    },
  });
  return { fakepay, sent };
};

test("creates an intent for a whole number of cents", async () => {
  const { fakepay } = provider();
  const intent = await fakepay.createIntent({ amountCents: 4496, reference: "SO-TEST" });
  assert.match(intent.id, /^pi_/);
  assert.equal(intent.status, "requires_payment");
  await assert.rejects(fakepay.createIntent({ amountCents: 44.96, reference: "SO-TEST" }), ProviderError);
});

test("sends a signed payment.succeeded event when the shopper pays", async () => {
  const { fakepay, sent } = provider();
  const intent = await fakepay.createIntent({ amountCents: 4496, reference: "SO-TEST" });
  await fakepay.simulatePayment(intent.id);
  assert.equal(sent.length, 1);
  const event = verifyWebhook({ secret, header: sent[0].signature, body: sent[0].body });
  assert.equal(event.type, "payment.succeeded");
  assert.equal(event.data.intent_id, intent.id);
  assert.equal(event.data.amount, 4496);
  await assert.rejects(fakepay.simulatePayment(intent.id), { code: "intent_unexpected_state" });
});

test("retries a delivery the receiver didn't accept", async () => {
  let attempts = 0;
  const fakepay = createPaymentProvider("fakepay", {
    webhookSecret: secret,
    deliver: async () => {
      attempts += 1;
      return attempts === 3;
    },
  });
  const intent = await fakepay.createIntent({ amountCents: 100, reference: "SO-RETRY" });
  await fakepay.simulatePayment(intent.id);
  assert.equal(attempts, 3);
});

test("refunds up to what was charged", async () => {
  const { fakepay } = provider();
  const intent = await fakepay.createIntent({ amountCents: 1000, reference: "SO-REFUND" });
  const { chargeId } = await fakepay.simulatePayment(intent.id);
  const refund = await fakepay.refund({ chargeId, amountCents: 600 });
  assert.equal(refund.status, "succeeded");
  await assert.rejects(fakepay.refund({ chargeId, amountCents: 500 }), { code: "amount_too_large" });
  await assert.rejects(fakepay.refund({ chargeId: "ch_missing", amountCents: 1 }), { code: "resource_missing" });
});

test("cancels an unpaid intent only", async () => {
  const { fakepay } = provider();
  const unpaid = await fakepay.createIntent({ amountCents: 1000, reference: "SO-A" });
  assert.equal((await fakepay.cancelIntent(unpaid.id)).status, "cancelled");
  const paid = await fakepay.createIntent({ amountCents: 1000, reference: "SO-B" });
  await fakepay.simulatePayment(paid.id);
  await assert.rejects(fakepay.cancelIntent(paid.id), { code: "intent_unexpected_state" });
});

test("refuses an unknown provider name", () => {
  assert.throws(() => createPaymentProvider("cardco", { webhookSecret: secret }), /Unknown payment provider/);
});
