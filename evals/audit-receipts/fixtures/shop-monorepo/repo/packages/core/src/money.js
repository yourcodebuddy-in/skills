import { CURRENCY } from "./constants.js";
import { ValidationError } from "./errors.js";

// All amounts are integer cents (see docs/adr/0002-money-in-integer-cents.md).

const formatters = new Map();

const formatterFor = (currency) => {
  let formatter = formatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-US", { style: "currency", currency });
    formatters.set(currency, formatter);
  }
  return formatter;
};

export const formatCents = (cents, currency = CURRENCY) => formatterFor(currency).format(cents / 100);

export const isCents = (value) => Number.isSafeInteger(value) && value >= 0;

export const assertCents = (value, field = "amount") => {
  if (!isCents(value)) {
    throw new ValidationError(`${field} must be a whole number of cents`, { field });
  }
  return value;
};

export const sumCents = (values) => {
  let total = 0;
  for (const value of values) {
    total += value;
  }
  return total;
};

export const percentOf = (cents, percent) => Math.round((cents * percent) / 100);

export const basisPointsOf = (cents, basisPoints) => Math.round((cents * basisPoints) / 10_000);
