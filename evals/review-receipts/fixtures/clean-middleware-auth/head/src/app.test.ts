import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "./app.ts";

test("admins can count users", () => {
  assert.equal(createApp().handle({ path: "/admin/users/count", role: "admin" }).status, 200);
});

test("others are refused", () => {
  assert.equal(createApp().handle({ path: "/admin/users/count", role: "member" }).status, 403);
  assert.equal(createApp().handle({ path: "/admin/users/export", role: "member" }).status, 403);
  assert.equal(createApp().handle({ path: "/admin/users/export" }).status, 403);
});

test("admins can export a page of users", () => {
  const response = createApp().handle({ path: "/admin/users/export", role: "admin", query: { page: "1" } });
  assert.equal((response.body as unknown[]).length, 2);
});
