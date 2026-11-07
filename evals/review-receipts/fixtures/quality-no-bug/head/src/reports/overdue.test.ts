import assert from "node:assert/strict";
import { test } from "node:test";
import { overdueReport } from "./overdue.ts";

const base = { customerId: "c1", dueDate: "2026-01-01", cancelledAt: null, amountCents: 100 };
const customers = [{ id: "c1", name: "Ada" }];
const now = new Date("2026-02-01");

test("includes overdue orders", () => {
  const rows = overdueReport([{ ...base, id: "o1", paidAt: null }], customers, now);
  assert.deepEqual(rows, [{ orderId: "o1", customer: "Ada", amountCents: 100 }]);
});

test("skips paid orders", () => {
  assert.deepEqual(overdueReport([{ ...base, id: "o2", paidAt: "2026-01-02" }], customers, now), []);
});

test("labels missing customers", () => {
  assert.equal(overdueReport([{ ...base, id: "o3", paidAt: null }], [], now)[0].customer, "Unknown");
});
