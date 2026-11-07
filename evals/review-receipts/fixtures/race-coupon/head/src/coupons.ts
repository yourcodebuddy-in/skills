import { read, write } from "./store.ts";

export type Coupon = { percentOff: number; uses: number; maxUses: number };

export async function redeemCoupon(code: string): Promise<number> {
  const coupon = await read<Coupon>(`coupon:${code}`);
  if (!coupon) throw new Error("unknown coupon");
  if (coupon.uses >= coupon.maxUses) throw new Error("coupon used up");
  await write(`coupon:${code}`, { ...coupon, uses: coupon.uses + 1 });
  return coupon.percentOff;
}
