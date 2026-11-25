// The docs say a code works up to and including its last day (UTC); the code rejects it from the
// first moment of that day. Run from the root of a copy of repo/.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const { checkCoupon } = await import(pathToFileURL(join(root, "packages/core/src/coupons.js")).href);

const readme = readFileSync(join(root, "README.md"), "utf8").replace(/\s+/g, " ");
const api = readFileSync(join(root, "docs/api.md"), "utf8");
const promised = readme.includes("work up to and including their last day (UTC)") && api.includes("`expiresOn` is the last day the code works");

const coupon = { code: "CYBER", percentOff: 20, amountOffCents: null, minSubtotalCents: 0, maxRedemptions: null, redemptions: 0, expiresOn: "2026-12-01" };
const onLastDay = new Date("2026-12-01T15:00:00Z");
let result;
try {
  checkCoupon(coupon, { now: onLastDay, subtotalCents: 5000 });
  result = "accepted";
} catch (error) {
  result = error.code;
}
console.log("docs promise the last day counts:", promised);
console.log("code with last day 2026-12-01, checked at 2026-12-01T15:00Z:", result);
process.exit(promised && result === "coupon_expired" ? 0 : 1);
