import assert from "node:assert/strict";
import { test } from "node:test";
import { health } from "./app.ts";

test("health", () => assert.deepEqual(health(), { ok: true }));
