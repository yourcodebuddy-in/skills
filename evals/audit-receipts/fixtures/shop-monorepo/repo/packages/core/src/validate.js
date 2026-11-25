import { MAX_LINE_QUANTITY, NOTE_MAX_LENGTH, ORDER_STATUSES } from "./constants.js";
import { isIsoDay } from "./dates.js";
import { ValidationError } from "./errors.js";
import { assertCents } from "./money.js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COUNTRY = /^[A-Z]{2}$/;
const SKU = /^[A-Z0-9-]{3,32}$/;
const COUPON_CODE = /^[A-Z0-9]{3,20}$/;

const fail = (field, message) => {
  throw new ValidationError(message, { field });
};

export const requireString = (value, field, { min = 1, max = 200 } = {}) => {
  if (typeof value !== "string") {
    fail(field, `${field} is required`);
  }
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) {
    fail(field, `${field} must be between ${min} and ${max} characters`);
  }
  return trimmed;
};

const optionalString = (value, field, options) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  return requireString(value, field, options);
};

export const parseEmail = (value) => {
  const email = requireString(value, "email", { max: 254 }).toLowerCase();
  if (!EMAIL.test(email)) {
    fail("email", "email doesn't look like an email address");
  }
  return email;
};

export const parsePassword = (value) => {
  if (typeof value !== "string" || value.length < 10 || value.length > 200) {
    fail("password", "password must be between 10 and 200 characters");
  }
  return value;
};

export const parseId = (value, field = "id") => {
  const id = typeof value === "string" ? Number(value) : value;
  if (!Number.isSafeInteger(id) || id < 1) {
    fail(field, `${field} must be a positive whole number`);
  }
  return id;
};

const parseCount = (value, field) => {
  if (!Number.isSafeInteger(value) || value < 0) {
    fail(field, `${field} must be zero or a positive whole number`);
  }
  return value;
};

export const parseQuantity = (value) => {
  if (!Number.isInteger(value) || value < 1 || value > MAX_LINE_QUANTITY) {
    fail("quantity", `quantity must be between 1 and ${MAX_LINE_QUANTITY}`);
  }
  return value;
};

export const parseCountry = (value) => {
  const country = requireString(value, "country", { min: 2, max: 2 }).toUpperCase();
  if (!COUNTRY.test(country)) {
    fail("country", "country must be a two-letter code");
  }
  return country;
};

export const parseCartLine = (body) => ({
  productId: parseId(body.productId, "productId"),
  quantity: parseQuantity(body.quantity ?? 1),
  unitPriceCents: body.priceCents === undefined ? undefined : assertCents(body.priceCents, "priceCents"),
});

export const parseShipping = (body) => {
  if (!body || typeof body !== "object") {
    fail("shipping", "shipping address is required");
  }
  return {
    name: requireString(body.name, "shipping.name", { max: 100 }),
    line1: requireString(body.line1, "shipping.line1", { max: 200 }),
    line2: optionalString(body.line2, "shipping.line2", { max: 200 }),
    city: requireString(body.city, "shipping.city", { max: 100 }),
    postcode: requireString(body.postcode, "shipping.postcode", { max: 20 }),
    country: parseCountry(body.country),
  };
};

export const parseNote = (value) => optionalString(value, "note", { max: NOTE_MAX_LENGTH });

export const parseCouponCode = (value) => {
  const code = optionalString(value, "couponCode", { max: 20 });
  if (code === null) {
    return null;
  }
  const normalized = code.toUpperCase();
  if (!COUPON_CODE.test(normalized)) {
    fail("couponCode", "couponCode must be 3 to 20 letters or digits");
  }
  return normalized;
};

export const parseProductInput = (body, { partial = false } = {}) => {
  const product = {};
  const has = (key) => body[key] !== undefined;
  if (!partial || has("sku")) {
    const sku = requireString(body.sku, "sku", { max: 32 }).toUpperCase();
    if (!SKU.test(sku)) {
      fail("sku", "sku must be 3 to 32 letters, digits or dashes");
    }
    product.sku = sku;
  }
  if (!partial || has("name")) {
    product.name = requireString(body.name, "name", { max: 120 });
  }
  if (!partial || has("description")) {
    product.description = optionalString(body.description, "description", { max: 2000 }) ?? "";
  }
  if (!partial || has("priceCents")) {
    product.priceCents = assertCents(body.priceCents, "priceCents");
  }
  if (!partial || has("stock")) {
    product.stock = parseCount(body.stock ?? 0, "stock");
  }
  if (has("active")) {
    if (typeof body.active !== "boolean") {
      fail("active", "active must be true or false");
    }
    product.active = body.active;
  }
  return product;
};

export const parseCouponInput = (body) => {
  const code = parseCouponCode(body.code);
  if (code === null) {
    fail("code", "code is required");
  }
  const hasPercent = body.percentOff !== undefined;
  const hasAmount = body.amountOffCents !== undefined;
  if (hasPercent === hasAmount) {
    fail("percentOff", "give either percentOff or amountOffCents");
  }
  if (hasPercent && (!Number.isInteger(body.percentOff) || body.percentOff < 1 || body.percentOff > 90)) {
    fail("percentOff", "percentOff must be between 1 and 90");
  }
  if (body.expiresOn !== undefined && body.expiresOn !== null && !isIsoDay(body.expiresOn)) {
    fail("expiresOn", "expiresOn must be a date like 2026-12-31");
  }
  return {
    code,
    percentOff: hasPercent ? body.percentOff : null,
    amountOffCents: hasAmount ? assertCents(body.amountOffCents, "amountOffCents") : null,
    minSubtotalCents: assertCents(body.minSubtotalCents ?? 0, "minSubtotalCents"),
    maxRedemptions: body.maxRedemptions === undefined || body.maxRedemptions === null ? null : parseId(body.maxRedemptions, "maxRedemptions"),
    expiresOn: body.expiresOn ?? null,
  };
};

export const parseStatusFilter = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (!ORDER_STATUSES.includes(value)) {
    fail("status", `status must be one of ${ORDER_STATUSES.join(", ")}`);
  }
  return value;
};

export const parsePage = (value) => {
  if (value === null || value === undefined || value === "") {
    return 1;
  }
  return parseId(value, "page");
};

export const parseDay = (value, field) => {
  if (!isIsoDay(value)) {
    fail(field, `${field} must be a date like 2026-12-31`);
  }
  return value;
};
