import assert from "node:assert/strict";
import { test } from "node:test";
import { getUser } from "./users.ts";

test("finds a user", () => assert.equal(getUser("u1").name, "Ada"));
