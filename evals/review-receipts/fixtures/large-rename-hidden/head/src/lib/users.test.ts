import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchUser } from "./users.ts";

test("finds a user", () => assert.equal(fetchUser("u1").name, "Ada"));
