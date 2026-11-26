import { randomBytes } from 'node:crypto';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// 128 random bits, hex encoded. Used for hold and order links, which act as bearer credentials.
export function newToken() {
  return randomBytes(16).toString('hex');
}

// Ticket codes are printed and read out at the door, so they avoid look-alike characters.
export function ticketCode(length = 10) {
  const bytes = randomBytes(length);
  let code = '';
  for (const byte of bytes) code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  return code;
}

export function apiKeyParts() {
  return { prefix: randomBytes(4).toString('hex'), secret: randomBytes(24).toString('base64url') };
}
