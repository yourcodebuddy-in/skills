export const CURRENCY = "USD";
export const DOMESTIC_COUNTRY = "US";

export const SHIPPING_FLAT_CENTS = 599;
export const SHIPPING_INTERNATIONAL_CENTS = 1999;
export const FREE_SHIPPING_MIN_CENTS = 7500;

// Sales tax by destination country, in basis points. Exports are zero-rated.
export const TAX_RATES_BPS = Object.freeze({ US: 825 });

export const MAX_LINE_QUANTITY = 10;
export const MAX_CART_LINES = 30;
export const NOTE_MAX_LENGTH = 500;
export const UNPAID_ORDER_MINUTES = 30;

export const ORDER_STATUSES = Object.freeze(["pending_payment", "paid", "fulfilled", "cancelled", "refunded"]);
