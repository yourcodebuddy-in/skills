import { invalid } from '../http/errors.js';
import { isValidTimeZone } from './time.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

export function requireObject(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw invalid('body', 'must be a JSON object');
  return body;
}

export function requireString(body, field, { max = 200 } = {}) {
  const value = body[field];
  if (typeof value !== 'string' || value.trim() === '') throw invalid(field, 'required');
  if (value.length > max) throw invalid(field, `at most ${max} characters`);
  return value.trim();
}

export function optionalString(body, field, options) {
  return body[field] === undefined ? undefined : requireString(body, field, options);
}

export function requireInt(body, field, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) {
  const value = body[field];
  if (!Number.isSafeInteger(value)) throw invalid(field, 'must be a whole number');
  if (value < min) throw invalid(field, `must be at least ${min}`);
  if (value > max) throw invalid(field, `must be at most ${max}`);
  return value;
}

export function optionalInt(body, field, options) {
  return body[field] === undefined ? undefined : requireInt(body, field, options);
}

export function requireEmail(body, field) {
  const value = requireString(body, field, { max: 254 }).toLowerCase();
  if (!EMAIL.test(value)) throw invalid(field, 'must be an email address');
  return value;
}

export function requireInstant(body, field) {
  const value = requireString(body, field, { max: 40 });
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || !/[zZ]|[+-]\d{2}:\d{2}$/.test(value)) {
    throw invalid(field, 'must be an ISO 8601 date and time with an offset');
  }
  return date.toISOString();
}

export function optionalInstant(body, field) {
  return body[field] === undefined ? undefined : requireInstant(body, field);
}

export function requireSlug(value, field = 'slug') {
  if (typeof value !== 'string' || !SLUG.test(value)) throw invalid(field, 'lowercase letters, digits and dashes');
  return value;
}

export function requireTimeZone(value, field = 'timezone') {
  if (typeof value !== 'string' || !isValidTimeZone(value)) throw invalid(field, 'must be an IANA time zone');
  return value;
}

export function parseId(value, field = 'id') {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw invalid(field, 'must be a positive whole number');
  return id;
}
