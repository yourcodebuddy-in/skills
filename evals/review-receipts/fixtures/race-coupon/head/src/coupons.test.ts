import assert from "node:assert/strict";
import { test } from "node:test";
import { redeemCoupon } from "./coupons.ts";
import { write } from "./store.ts";

test("returns the discount and counts the use", async () => {
  await write("coupon:a", { percentOff: 10, uses: 0, maxUses: 1 });
  assert.equal(await redeemCoupon("a"), 10);
  await assert.rejects(redeemCoupon("a"), /used up/);
});
