import assert from "node:assert/strict";
import test from "node:test";
import {
  parseCartLine,
  parseCouponInput,
  parseEmail,
  parseProductInput,
  parseShipping,
  parseStatusFilter,
} from "../src/validate.js";

test("normalizes email addresses", () => {
  assert.equal(parseEmail("  Sam@Example.COM "), "sam@example.com");
  assert.throws(() => parseEmail("not an email"), { code: "invalid_request" });
});

test("reads a cart line with a default quantity of one", () => {
  assert.deepEqual(parseCartLine({ productId: 3 }), { productId: 3, quantity: 1, unitPriceCents: undefined });
  assert.throws(() => parseCartLine({ productId: 3, quantity: 0 }), /quantity/);
  assert.throws(() => parseCartLine({ productId: "abc" }), /productId/);
});

test("reads a shipping address and upper-cases the country", () => {
  const shipping = parseShipping({ name: " Sam ", line1: "1 Main St", city: "Springfield", postcode: "12345", country: "us" });
  assert.equal(shipping.name, "Sam");
  assert.equal(shipping.line2, null);
  assert.equal(shipping.country, "US");
  assert.throws(() => parseShipping({ name: "Sam" }), /shipping.line1/);
});

test("requires every product field when creating, and only given ones when editing", () => {
  assert.throws(() => parseProductInput({ name: "Mug" }), /sku/);
  assert.deepEqual(parseProductInput({ priceCents: 1999 }, { partial: true }), { priceCents: 1999 });
  assert.throws(() => parseProductInput({ priceCents: 19.99 }, { partial: true }), /priceCents/);
});

test("reads a coupon with exactly one kind of discount", () => {
  const coupon = parseCouponInput({ code: "save5", amountOffCents: 500, expiresOn: "2026-12-31" });
  assert.equal(coupon.code, "SAVE5");
  assert.equal(coupon.percentOff, null);
  assert.throws(() => parseCouponInput({ code: "BOTH", amountOffCents: 500, percentOff: 10 }), /either/);
  assert.throws(() => parseCouponInput({ code: "LATE", percentOff: 10, expiresOn: "31/12/2026" }), /expiresOn/);
});

test("accepts only known order statuses as a filter", () => {
  assert.equal(parseStatusFilter(null), null);
  assert.equal(parseStatusFilter("paid"), "paid");
  assert.throws(() => parseStatusFilter("lost"), /status/);
});
