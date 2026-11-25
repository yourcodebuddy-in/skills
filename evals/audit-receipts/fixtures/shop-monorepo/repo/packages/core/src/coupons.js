import { hasPassed } from "./dates.js";
import { CouponError } from "./errors.js";
import { formatCents, percentOf } from "./money.js";

export const checkCoupon = (coupon, { now, subtotalCents }) => {
  if (!coupon) {
    throw new CouponError("That code isn't valid", "coupon_invalid");
  }
  if (coupon.expiresOn && hasPassed(coupon.expiresOn, now)) {
    throw new CouponError("That code has expired", "coupon_expired");
  }
  if (coupon.maxRedemptions !== null && coupon.redemptions >= coupon.maxRedemptions) {
    throw new CouponError("That code has been used up", "coupon_used_up");
  }
  if (subtotalCents < coupon.minSubtotalCents) {
    throw new CouponError(`Spend ${formatCents(coupon.minSubtotalCents)} or more to use this code`, "coupon_minimum");
  }
  return coupon;
};

export const discountFor = (coupon, subtotalCents) => {
  if (!coupon) {
    return 0;
  }
  const discount = coupon.percentOff === null ? coupon.amountOffCents : percentOf(subtotalCents, coupon.percentOff);
  return Math.min(discount, subtotalCents);
};
