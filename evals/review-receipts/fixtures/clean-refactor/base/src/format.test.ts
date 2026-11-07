import assert from "node:assert/strict";
import { test } from "node:test";
import { cartLine } from "./cart.ts";
import { receiptTotal } from "./receipt.ts";

test("formats a cart line", () => {
  assert.equal(cartLine("Mug", 1250, 2), "Mug x2: $25.00");
  assert.equal(cartLine("Pen", 105, 1), "Pen x1: $1.05");
});

test("formats a receipt total", () => {
  assert.equal(receiptTotal([{ cents: 199, quantity: 3 }, { cents: 1, quantity: 4 }]), "Total: $6.01");
  assert.equal(receiptTotal([]), "Total: $0.00");
});
