import { createHmac, timingSafeEqual } from 'node:crypto';

// The provider signs each webhook body with HMAC-SHA256 and the shared secret, hex encoded.
export function sign(rawBody, secret) {
  return createHmac('sha256', secret).update(rawBody).digest('hex');
}

export function verifySignature(rawBody, signature, secret) {
  if (!secret || typeof signature !== 'string' || !/^[0-9a-f]{64}$/.test(signature)) return false;
  const expected = Buffer.from(sign(rawBody, secret), 'hex');
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}

export function parseEvent(rawBody) {
  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return null;
  }
  if (!event || typeof event.type !== 'string' || typeof event.data !== 'object' || event.data === null) return null;
  return event;
}
