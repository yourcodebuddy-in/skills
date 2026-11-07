import { pathToFileURL } from "node:url";
const load = (p) => import(pathToFileURL(`${process.cwd()}/${p}`).href);
const { redeemCoupon } = await load("src/coupons.ts");
const { write } = await load("src/store.ts");
await write("coupon:x", { percentOff: 10, uses: 0, maxUses: 1 });
const results = await Promise.allSettled([redeemCoupon("x"), redeemCoupon("x")]);
process.exit(results.every((r) => r.status === "fulfilled") ? 0 : 1);
