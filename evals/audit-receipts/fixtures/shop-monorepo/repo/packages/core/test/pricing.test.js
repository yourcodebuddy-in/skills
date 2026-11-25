import assert from "node:assert/strict";
import test from "node:test";
import { quote, shippingFor, taxFor } from "../src/pricing.js";

const line = (unitPriceCents, quantity = 1) => ({ productId: 1, unitPriceCents, quantity });

test("charges flat US shipping below the free-shipping minimum", () => {
  assert.equal(shippingFor(7499, "US"), 599);
  assert.equal(shippingFor(7500, "US"), 0);
});

test("charges international shipping whatever the order size", () => {
  assert.equal(shippingFor(100, "CA"), 1999);
  assert.equal(shippingFor(50000, "GB"), 1999);
});

test("charges US sales tax and zero-rates exports", () => {
  assert.equal(taxFor(10000, "US"), 825);
  assert.equal(taxFor(10000, "DE"), 0);
});

test("quotes an order with no discount", () => {
  assert.deepEqual(quote({ lines: [line(1800, 2)], country: "US" }), {
    subtotalCents: 3600,
    discountCents: 0,
    shippingCents: 599,
    taxCents: 297,
    totalCents: 4496,
  });
});

test("applies the discount before shipping and tax", () => {
  const coupon = { percentOff: 10, amountOffCents: null };
  const result = quote({ lines: [line(4000, 2)], coupon, country: "US" });
  assert.equal(result.subtotalCents, 8000);
  assert.equal(result.discountCents, 800);
  assert.equal(result.shippingCents, 599, "7,200 after the discount is under the minimum");
  assert.equal(result.taxCents, 594);
  assert.equal(result.totalCents, 7200 + 599 + 594);
});

test("never discounts below zero", () => {
  const coupon = { percentOff: null, amountOffCents: 5000 };
  const result = quote({ lines: [line(1200)], coupon, country: "US" });
  assert.equal(result.discountCents, 1200);
  assert.equal(result.taxCents, 0);
});

test("quotes an empty cart as zero", () => {
  assert.equal(quote({ lines: [] }).totalCents, 0);
});
