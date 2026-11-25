// The API stores whatever priceCents the browser sends for a cart line, and checkout charges it.
// Run from the root of a copy of repo/.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const load = (path) => import(pathToFileURL(join(root, path)).href);
const { createTestApp, SHIPPING } = await load("apps/api/test/helpers.js");

const t = createTestApp();
const grinder = t.addProduct({ sku: "GRINDER-HAND", name: "Hand grinder", priceCents: 8900, stock: 5 });
const { cookie } = await t.signUp();

const added = await t.request({ method: "POST", path: "/api/cart/items", cookie, body: { productId: grinder.id, quantity: 1, priceCents: 1 } });
const placed = await t.request({ method: "POST", path: "/api/checkout", cookie, body: { shipping: { ...SHIPPING, country: "DE" } } });

const order = placed.body?.order;
const storefront = readFileSync(join(root, "apps/web/public/js/storefront.js"), "utf8");
const webSendsPrice = /priceCents:\s*product\.priceCents/.test(storefront);

console.log("cart add status", added.status, "checkout status", placed.status);
console.log("charged unit price", order?.items[0].unitPriceCents, "catalogue price", grinder.priceCents, "order total", order?.totalCents);
console.log("storefront sends priceCents from the page:", webSendsPrice);

const happened = added.status === 201 && placed.status === 201 && order.items[0].unitPriceCents === 1 && order.subtotalCents === 1 && webSendsPrice;
process.exit(happened ? 0 : 1);
