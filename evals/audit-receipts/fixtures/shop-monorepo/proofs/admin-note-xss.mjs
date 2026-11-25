// A shopper's delivery note reaches the admin order page as raw HTML. Run from the root of a copy of repo/.
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const load = (path) => import(pathToFileURL(join(root, path)).href);
const { createTestApp, checkout } = await load("apps/api/test/helpers.js");
const { renderOrderDetail } = await load("apps/web/public/js/admin-views.js");

const payload = `<img src=x onerror="fetch('/api/admin/orders')">`;
const t = createTestApp();
const product = t.addProduct();
const shopper = await t.signUp();
const admin = await t.signUp({ email: "staff@example.com", admin: true });
const { order } = await checkout(t, shopper.cookie, [{ productId: product.id }], { note: payload });

const detail = await t.request({ path: `/api/admin/orders/${order.number}`, cookie: admin.cookie });
const html = renderOrderDetail(detail.body.order);
const page = await t.request({ path: "/admin" });

const rawInHtml = html.includes(payload);
const noCsp = !Object.keys(page.headers).some((name) => name.toLowerCase() === "content-security-policy");
console.log("note stored and returned unchanged:", detail.body.order.note === payload);
console.log("admin detail HTML contains the raw tag:", rawInHtml);
console.log("admin page has no Content-Security-Policy:", noCsp);
process.exit(rawInHtml && noCsp ? 0 : 1);
