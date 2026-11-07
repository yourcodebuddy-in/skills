import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "./app.ts";

test("admins can count users", () => {
  assert.equal(createApp().handle({ path: "/admin/users/count", role: "admin" }).status, 200);
});

test("others are refused", () => {
  assert.equal(createApp().handle({ path: "/admin/users/count", role: "member" }).status, 403);
});
