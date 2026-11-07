import assert from "node:assert/strict";
import { test } from "node:test";
import { parseDuration } from "./duration.ts";

test("parses units", () => {
  assert.equal(parseDuration("5m"), 300_000);
  assert.equal(parseDuration("250ms"), 250);
});

test("rejects garbage", () => {
  assert.throws(() => parseDuration("soon"));
});
