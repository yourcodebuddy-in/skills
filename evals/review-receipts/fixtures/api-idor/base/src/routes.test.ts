import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { handle } from "./routes.ts";
import { startSession } from "./session.ts";
import { seed } from "./store.ts";

beforeEach(() => {
  seed([{ id: "inv_1", accountId: "acct_a", amountCents: 1200, notes: "" }]);
  startSession("token_a", "acct_a");
});

test("lists the caller's invoices", () => {
  const response = handle({ method: "GET", path: "/invoices", headers: { authorization: "Bearer token_a" } });
  assert.equal(response.status, 200);
  assert.equal((response.body as unknown[]).length, 1);
});

test("rejects missing session", () => {
  assert.equal(handle({ method: "GET", path: "/invoices", headers: {} }).status, 401);
});
