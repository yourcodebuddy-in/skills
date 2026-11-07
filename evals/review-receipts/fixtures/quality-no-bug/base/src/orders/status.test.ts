import assert from "node:assert/strict";
import { test } from "node:test";
import { isOverdue } from "./status.ts";

const order = { id: "o", customerId: "c", dueDate: "2026-01-01", paidAt: null, cancelledAt: null, amountCents: 100 };

test("unpaid past due is overdue", () => assert.equal(isOverdue(order, new Date("2026-02-01")), true));
test("paid is not overdue", () => assert.equal(isOverdue({ ...order, paidAt: "2026-01-01" }, new Date("2026-02-01")), false));
