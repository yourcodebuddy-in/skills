// ADR 0004 replaces CSRF tokens with a SameSite=Strict HttpOnly cookie, JSON-only state changes and
// no CORS headers. The code does all three. Run from the root of a copy of repo/.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const { createTestApp, checkout } = await import(pathToFileURL(join(root, "apps/api/test/helpers.js")).href);

const t = createTestApp();
const product = t.addProduct({ stock: 5 });
const { cookie } = await t.signUp();
const admin = await t.signUp({ email: "staff@example.com", admin: true });
const { order } = await checkout(t, cookie, [{ productId: product.id }]);

const login = await t.request({ method: "POST", path: "/api/account/login", body: { email: "shopper@example.com", password: "correct horse battery" } });
const setCookie = login.headers["set-cookie"];
const cookieOk = /HttpOnly/.test(setCookie) && /SameSite=Strict/.test(setCookie) && /Path=\//.test(setCookie);

// What a cross-site form or no-preflight fetch can send.
const types = ["application/x-www-form-urlencoded", "multipart/form-data; boundary=x", "text/plain", undefined];
const targets = [
  { path: "/api/cart/items", cookie, body: `productId=${product.id}` },
  { path: `/api/orders/${order.number}/cancel`, cookie, body: "" },
  { path: "/api/account/logout", cookie, body: "" },
  { path: `/api/admin/orders/${order.number}/fulfil`, cookie: admin.cookie, body: "" },
  { path: "/api/admin/coupons", cookie: admin.cookie, body: "code=FREE&percentOff=90" },
];
let all415 = true;
for (const target of targets) {
  for (const type of types) {
    const headers = type ? { "content-type": type } : { "content-type": "" };
    const response = await t.request({ method: "POST", path: target.path, cookie: target.cookie, body: target.body, headers });
    if (response.status !== 415) {
      all415 = false;
      console.log("not refused:", target.path, type, response.status);
    }
  }
}
const preflight = await t.request({ method: "OPTIONS", path: "/api/cart/items", headers: { origin: "https://evil.example", "access-control-request-method": "POST" } });
const noCorsHeader = !Object.keys(preflight.headers).some((name) => name.startsWith("access-control-"));

const sources = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (full.endsWith(".js")) {
      sources.push(readFileSync(full, "utf8"));
    }
  }
};
walk(join(root, "apps/api/src"));
const corsInCode = sources.some((text) => /Access-Control-Allow/i.test(text));
const getRoutesOnlyRead = sources.every((text) => !/router\.get\([^)]*\b(transaction|setStatus|create|delete)\(/.test(text));

console.log("cookie flags:", setCookie);
console.log("every non-JSON state change refused with 415:", all415, "| preflight", preflight.status, "with no CORS headers:", noCorsHeader, "| CORS in code:", corsInCode);
process.exit(cookieOk && all415 && noCorsHeader && !corsInCode && getRoutesOnlyRead ? 0 : 1);
