import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { handle } from "./routes.ts";
import { startSession } from "./session.ts";
import { seed } from "./store.ts";

const auth = { authorization: "Bearer token_a" };

beforeEach(() => {
  seed([{ id: "inv_1", accountId: "acct_a", amountCents: 1200, notes: "" }]);
  startSession("token_a", "acct_a");
});

test("lists the caller's invoices", () => {
  const response = handle({ method: "GET", path: "/invoices", headers: auth });
  assert.equal(response.status, 200);
  assert.equal((response.body as unknown[]).length, 1);
});

test("rejects missing session", () => {
  assert.equal(handle({ method: "GET", path: "/invoices", headers: {} }).status, 401);
});

test("reads one invoice", () => {
  assert.equal(handle({ method: "GET", path: "/invoices/inv_1", headers: auth }).status, 200);
});

test("returns 404 for an unknown invoice", () => {
  assert.equal(handle({ method: "GET", path: "/invoices/nope", headers: auth }).status, 404);
});

test("updates notes", () => {
  const response = handle({ method: "PATCH", path: "/invoices/inv_1", headers: auth, body: { notes: "paid by wire" } });
  assert.equal((response.body as { notes: string }).notes, "paid by wire");
});

test("rejects oversized notes", () => {
  const body = { notes: "x".repeat(2001) };
  assert.equal(handle({ method: "PATCH", path: "/invoices/inv_1", headers: auth, body }).status, 400);
});
