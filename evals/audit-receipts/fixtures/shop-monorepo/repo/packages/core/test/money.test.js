import assert from "node:assert/strict";
import test from "node:test";
import { assertCents, basisPointsOf, formatCents, percentOf } from "../src/money.js";

test("formats cents as dollars", () => {
  assert.equal(formatCents(0), "$0.00");
  assert.equal(formatCents(1005), "$10.05");
  assert.equal(formatCents(123456), "$1,234.56");
});

test("rounds percentages and basis points to whole cents", () => {
  assert.equal(percentOf(1999, 10), 200);
  assert.equal(percentOf(1001, 15), 150);
  assert.equal(basisPointsOf(10000, 825), 825);
  assert.equal(basisPointsOf(1999, 825), 165);
});

test("accepts only whole, non-negative cents", () => {
  assert.equal(assertCents(0), 0);
  assert.equal(assertCents(1999), 1999);
  for (const bad of [-1, 19.99, "1999", null, Number.NaN, 2 ** 60]) {
    assert.throws(() => assertCents(bad, "priceCents"), /priceCents must be a whole number of cents/);
  }
});
