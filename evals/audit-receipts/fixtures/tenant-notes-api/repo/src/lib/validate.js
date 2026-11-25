import { NAME_MAX, PASSWORD_MAX, PASSWORD_MIN } from '../constants.js';
import { badRequest } from '../http/errors.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function readString(value, field, { min = 1, max }) {
  if (typeof value !== 'string') {
    throw badRequest(`${field} must be a string`);
  }
  const trimmed = value.trim();
  if (trimmed.length < min) {
    throw badRequest(min === 1 ? `${field} is required` : `${field} must be at least ${min} characters`);
  }
  if (trimmed.length > max) {
    throw badRequest(`${field} must be at most ${max} characters`);
  }
  return trimmed;
}

export function readEmail(value) {
  const email = readString(value, 'email', { max: 254 }).toLowerCase();
  if (!EMAIL.test(email)) {
    throw badRequest('email does not look like an email address');
  }
  return email;
}

export const readName = (value) => readString(value, 'name', { max: NAME_MAX });

export function readPassword(value) {
  if (typeof value !== 'string') {
    throw badRequest('password must be a string');
  }
  if (value.length < PASSWORD_MIN || value.length > PASSWORD_MAX) {
    throw badRequest(`password must be ${PASSWORD_MIN} to ${PASSWORD_MAX} characters`);
  }
  return value;
}

export function readId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
