import assert from "node:assert/strict";
import test from "node:test";
import { createStore, openDatabase } from "../src/index.js";

const NOW = "2026-11-01T00:00:00.000Z";

test("counts uses up to the limit and no further", () => {
  const store = createStore(openDatabase(":memory:"));
  store.coupons.create(
    { code: "TWICE", percentOff: 10, amountOffCents: null, minSubtotalCents: 0, maxRedemptions: 2, expiresOn: null },
    NOW,
  );
  assert.equal(store.coupons.redeem("TWICE"), true);
  assert.equal(store.coupons.redeem("TWICE"), true);
  assert.equal(store.coupons.redeem("TWICE"), false);
  assert.equal(store.coupons.find("TWICE").redemptions, 2);
  store.coupons.release("TWICE");
  assert.equal(store.coupons.find("TWICE").redemptions, 1);
});
