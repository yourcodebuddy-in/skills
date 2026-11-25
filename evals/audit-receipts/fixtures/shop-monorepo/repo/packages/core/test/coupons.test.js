import assert from "node:assert/strict";
import test from "node:test";
import { checkCoupon, discountFor } from "../src/coupons.js";

const coupon = (overrides = {}) => ({
  code: "AUTUMN",
  percentOff: 15,
  amountOffCents: null,
  minSubtotalCents: 0,
  maxRedemptions: null,
  redemptions: 0,
  expiresOn: null,
  ...overrides,
});

const now = new Date("2026-11-10T15:00:00Z");

test("accepts a valid coupon", () => {
  assert.equal(checkCoupon(coupon(), { now, subtotalCents: 1000 }).code, "AUTUMN");
});

test("rejects a code that doesn't exist", () => {
  assert.throws(() => checkCoupon(undefined, { now, subtotalCents: 1000 }), { code: "coupon_invalid" });
});

test("accepts a coupon before its last day", () => {
  assert.doesNotThrow(() => checkCoupon(coupon({ expiresOn: "2026-11-20" }), { now, subtotalCents: 1000 }));
});

test("rejects a coupon after its last day", () => {
  assert.throws(() => checkCoupon(coupon({ expiresOn: "2026-10-31" }), { now, subtotalCents: 1000 }), {
    code: "coupon_expired",
  });
});

test("rejects a coupon with no uses left", () => {
  assert.throws(() => checkCoupon(coupon({ maxRedemptions: 3, redemptions: 3 }), { now, subtotalCents: 1000 }), {
    code: "coupon_used_up",
  });
});

test("rejects a coupon below its minimum spend", () => {
  assert.throws(() => checkCoupon(coupon({ minSubtotalCents: 5000 }), { now, subtotalCents: 4999 }), {
    code: "coupon_minimum",
    message: "Spend $50.00 or more to use this code",
  });
});

test("works out percent and fixed discounts", () => {
  assert.equal(discountFor(null, 1000), 0);
  assert.equal(discountFor(coupon(), 1999), 300);
  assert.equal(discountFor(coupon({ percentOff: null, amountOffCents: 500 }), 1999), 500);
  assert.equal(discountFor(coupon({ percentOff: null, amountOffCents: 500 }), 300), 300);
});
