import assert from "node:assert/strict";
import { test } from "node:test";
import { applyLoyaltyDiscount } from "./discount.ts";

const customer = { id: "c1", email: "a@example.com", orders: 12 };

test("takes ten percent off for loyal customers", () => {
  assert.equal(applyLoyaltyDiscount(customer, 2000), 1800);
});

test("leaves new customers alone", () => {
  assert.equal(applyLoyaltyDiscount({ ...customer, orders: 1 }, 2000), 2000);
});
