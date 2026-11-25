import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

const KEY_LENGTH = 64;
const SALT_BYTES = 16;
const COST = { N: 16_384, r: 8, p: 1 };

export async function hashPassword(password) {
  const salt = randomBytes(SALT_BYTES);
  const key = await scryptAsync(password, salt, KEY_LENGTH, COST);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  const [scheme, salt, key] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !key) {
    return false;
  }
  const expected = Buffer.from(key, 'base64');
  const actual = await scryptAsync(password, Buffer.from(salt, 'base64'), expected.length, COST);
  return timingSafeEqual(expected, actual);
}

let placeholderHash;

// Runs the same scrypt work as a real check, so a login for an unknown
// email takes as long as one with a wrong password.
export async function verifyAgainstPlaceholder(password) {
  placeholderHash ??= await hashPassword(randomBytes(16).toString('hex'));
  await verifyPassword(password, placeholderHash);
  return false;
}
