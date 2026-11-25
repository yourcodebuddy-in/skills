import assert from "node:assert/strict";
import test from "node:test";
import { createTestApp } from "./helpers.js";

test("registers, signs in and out", async () => {
  const t = createTestApp();
  const { cookie, user } = await t.signUp({ email: "Sam@Example.com" });
  assert.equal(user.email, "sam@example.com");

  const me = await t.request({ path: "/api/account/me", cookie });
  assert.equal(me.status, 200);
  assert.equal(me.body.user.name, "Sam Shopper");

  const out = await t.request({ method: "POST", path: "/api/account/logout", cookie });
  assert.equal(out.status, 204);
  assert.match(out.headers["set-cookie"], /Max-Age=0/);
  assert.equal((await t.request({ path: "/api/account/me", cookie })).status, 401);

  const login = await t.request({
    method: "POST",
    path: "/api/account/login",
    body: { email: "sam@example.com", password: "correct horse battery" },
  });
  assert.equal(login.status, 200);
  assert.equal((await t.request({ path: "/api/account/me", cookie: t.sessionCookie(login) })).status, 200);
});

test("gives the same answer for a wrong password and an unknown email", async () => {
  const t = createTestApp();
  await t.signUp();
  const wrong = await t.request({ method: "POST", path: "/api/account/login", body: { email: "shopper@example.com", password: "nope nope nope" } });
  const unknown = await t.request({ method: "POST", path: "/api/account/login", body: { email: "nobody@example.com", password: "nope nope nope" } });
  assert.equal(wrong.status, 401);
  assert.deepEqual(wrong.body, unknown.body);
});

test("refuses a second account with the same email", async () => {
  const t = createTestApp();
  await t.signUp();
  const again = await t.request({
    method: "POST",
    path: "/api/account/register",
    body: { email: "SHOPPER@example.com", name: "Other", password: "another long password" },
  });
  assert.equal(again.status, 409);
  assert.equal(again.body.error.code, "email_taken");
});

test("ends a session once it expires", async () => {
  let clock = new Date("2026-11-01T09:00:00Z");
  const t = createTestApp({ now: () => clock });
  const { cookie } = await t.signUp();
  clock = new Date("2026-11-01T20:59:00Z");
  assert.equal((await t.request({ path: "/api/account/me", cookie })).status, 200);
  clock = new Date("2026-11-01T21:01:00Z");
  assert.equal((await t.request({ path: "/api/account/me", cookie })).status, 401);
});

test("keeps staff pages from customers", async () => {
  const t = createTestApp();
  const { cookie } = await t.signUp();
  assert.equal((await t.request({ path: "/api/admin/orders", cookie })).status, 403);
  assert.equal((await t.request({ path: "/api/admin/orders" })).status, 401);
});
