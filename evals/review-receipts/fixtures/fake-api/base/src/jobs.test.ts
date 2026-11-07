import assert from "node:assert/strict";
import { test } from "node:test";
import { runJob } from "./jobs.ts";

test("returns the value", async () => {
  assert.deepEqual(await runJob(async () => "done"), { ok: true, value: "done" });
});
