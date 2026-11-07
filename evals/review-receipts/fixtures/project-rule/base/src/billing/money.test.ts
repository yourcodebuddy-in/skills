import assert from "node:assert/strict";
import { test } from "node:test";
import { percentOff } from "./money.ts";

test("rounds half up", () => assert.equal(percentOff(1999, 10), 1799));
