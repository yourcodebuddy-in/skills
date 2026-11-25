import assert from "node:assert/strict";
import test from "node:test";
import { WebhookError, computeSignature, signatureHeader, verifyWebhook } from "../src/webhooks.js";

const secret = "whsec_test_5d1c";
const nowSeconds = 1_790_000_000;
const event = {
  id: "evt_1",
  type: "payment.succeeded",
  created: nowSeconds,
  data: { intent_id: "pi_1", charge_id: "ch_1", amount: 1200 },
};
const body = JSON.stringify(event);

const sign = (payload, timestamp = nowSeconds) => signatureHeader(secret, timestamp, payload);

test("accepts a payload signed with the secret", () => {
  assert.deepEqual(verifyWebhook({ secret, header: sign(body), body, nowSeconds }), event);
});

test("rejects a payload signed with another secret", () => {
  const header = signatureHeader("whsec_someone_else", nowSeconds, body);
  assert.throws(() => verifyWebhook({ secret, header, body, nowSeconds }), WebhookError);
});

test("rejects a payload changed after signing", () => {
  const header = sign(body);
  const changed = body.replace("1200", "1");
  assert.throws(() => verifyWebhook({ secret, header, body: changed, nowSeconds }), WebhookError);
});

test("rejects a stale timestamp", () => {
  const stale = nowSeconds - 3600;
  assert.throws(() => verifyWebhook({ secret, header: sign(event, stale), body, nowSeconds }), WebhookError);
});

test("accepts a timestamp within the tolerance", () => {
  const header = sign(body, nowSeconds - 120);
  assert.equal(verifyWebhook({ secret, header, body, nowSeconds }).id, "evt_1");
});

test("accepts any matching signature while secrets rotate", () => {
  const header = `t=${nowSeconds},v1=${computeSignature("whsec_old", nowSeconds, body)},v1=${computeSignature(secret, nowSeconds, body)}`;
  assert.equal(verifyWebhook({ secret, header, body, nowSeconds }).id, "evt_1");
});

test("rejects a missing or malformed header", () => {
  for (const header of [undefined, "", "t=abc,v1=xyz", `v1=${computeSignature(secret, nowSeconds, body)}`]) {
    assert.throws(() => verifyWebhook({ secret, header, body, nowSeconds }), WebhookError);
  }
});
