import assert from "node:assert/strict";
import test from "node:test";
import { createTestApp } from "./helpers.js";

test("serves the storefront pages", async () => {
  const t = createTestApp();
  const home = await t.request({ path: "/" });
  assert.equal(home.status, 200);
  assert.match(home.headers["content-type"], /text\/html/);
  assert.equal((await t.request({ path: "/js/storefront.js" })).status, 200);
});

test("doesn't serve files outside the web folder", async () => {
  const t = createTestApp();
  for (const path of ["/../api/src/config.js", "/%2e%2e/api/src/config.js", "/js/%2e%2e%2f%2e%2e%2f%2e%2e%2fapi/src/config.js"]) {
    assert.equal((await t.request({ path })).status, 404, path);
  }
});

test("asks for JSON on every request that changes something", async () => {
  const t = createTestApp();
  const form = await t.request({
    method: "POST",
    path: "/api/account/login",
    body: "email=a%40b.c&password=x",
    headers: { "content-type": "application/x-www-form-urlencoded" },
  });
  assert.equal(form.status, 415);
});
