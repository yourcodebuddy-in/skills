// The free-shipping rule is written twice: core (US goods of $75+ after discount) and the cart page
// ($50+ before discount). They give different answers. Run from the root of a copy of repo/.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const load = (path) => import(pathToFileURL(join(root, path)).href);
const { shippingFor } = await load("packages/core/src/pricing.js");
const { shippingEstimate } = await load("apps/web/public/js/cart-summary.js");

const subtotal = 6000;
const core = shippingFor(subtotal, "US");
const web = shippingEstimate(subtotal);
const banner = readFileSync(join(root, "apps/web/public/index.html"), "utf8").includes("Free US shipping on orders of $50 or more");
const readme = readFileSync(join(root, "README.md"), "utf8").replace(/\s+/g, " ").includes("free when the goods come to $75 or more after any discount");

console.log(`US cart of $60.00: checkout charges ${core} cents shipping, cart page shows ${web}`);
console.log("storefront banner says $50:", banner, "| README says $75:", readme);
process.exit(core === 599 && web === 0 && banner && readme ? 0 : 1);
