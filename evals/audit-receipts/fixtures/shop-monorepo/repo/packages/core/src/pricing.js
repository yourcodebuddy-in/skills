import {
  DOMESTIC_COUNTRY,
  FREE_SHIPPING_MIN_CENTS,
  SHIPPING_FLAT_CENTS,
  SHIPPING_INTERNATIONAL_CENTS,
  TAX_RATES_BPS,
} from "./constants.js";
import { discountFor } from "./coupons.js";
import { basisPointsOf, sumCents } from "./money.js";

export const lineTotal = (line) => line.unitPriceCents * line.quantity;

// Shipping and tax are charged on the goods after any discount.
export const shippingFor = (goodsCents, country) => {
  if (country !== DOMESTIC_COUNTRY) {
    return SHIPPING_INTERNATIONAL_CENTS;
  }
  return goodsCents >= FREE_SHIPPING_MIN_CENTS ? 0 : SHIPPING_FLAT_CENTS;
};

export const taxFor = (goodsCents, country) => {
  const rate = Object.hasOwn(TAX_RATES_BPS, country) ? TAX_RATES_BPS[country] : 0;
  return basisPointsOf(goodsCents, rate);
};

export const quote = ({ lines, coupon = null, country = DOMESTIC_COUNTRY }) => {
  const subtotalCents = sumCents(lines.map(lineTotal));
  const discountCents = discountFor(coupon, subtotalCents);
  const goodsCents = subtotalCents - discountCents;
  const shippingCents = lines.length === 0 ? 0 : shippingFor(goodsCents, country);
  const taxCents = taxFor(goodsCents, country);
  return {
    subtotalCents,
    discountCents,
    shippingCents,
    taxCents,
    totalCents: goodsCents + shippingCents + taxCents,
  };
};
