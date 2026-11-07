import assert from "node:assert/strict";
import { test } from "node:test";
import { issueToken, verifyToken } from "./csrf.ts";

test("accepts the issued token", () => {
  assert.equal(verifyToken(issueToken("s1", "k"), "s1", "k"), true);
});

test("rejects another session's token", () => {
  assert.equal(verifyToken(issueToken("s2", "k"), "s1", "k"), false);
});
