import assert from "node:assert/strict";
import { test } from "node:test";
import { signup } from "./signup.ts";

test("sends a welcome", () => {
  const sent: string[] = [];
  signup("a@example.com", (to, text) => sent.push(`${to}:${text}`));
  assert.deepEqual(sent, ["a@example.com:Welcome!"]);
});
