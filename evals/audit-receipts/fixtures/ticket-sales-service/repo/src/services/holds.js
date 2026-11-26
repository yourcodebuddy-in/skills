import { transaction } from '../db.js';
import { conflict, HttpError, notFound } from '../http/errors.js';
import { newToken } from '../lib/ids.js';
import { addMinutes } from '../lib/time.js';
import { requireEmail, requireInt, requireObject, requireString } from '../lib/validate.js';
import { getEvent } from './events.js';

// Seats a tier can still sell: capacity, less paid tickets that haven't been refunded, less every
// active hold. Holds past their expiry still count until the worker releases them (see ADR 0005).
export function seatsLeft(db, tierId) {
  const row = db
    .prepare(
      `SELECT t.capacity
         - COALESCE((SELECT SUM(o.quantity - o.refunded_quantity) FROM orders o
                     WHERE o.tier_id = t.id AND o.status = 'paid'), 0)
         - COALESCE((SELECT SUM(h.quantity) FROM holds h
                     WHERE h.tier_id = t.id AND h.status = 'active'), 0) AS seats
       FROM tiers t WHERE t.id = ?`,
    )
    .get(tierId);
  return row ? row.seats : 0;
}

export function serializeHold(hold) {
  return {
    token: hold.token,
    eventId: hold.event_id,
    tierId: hold.tier_id,
    quantity: hold.quantity,
    unitPriceCents: hold.unit_price_cents,
    status: hold.status,
    expiresAt: hold.expires_at,
  };
}

export function createHold(ctx, eventId, body) {
  const { db, config, clock } = ctx;
  requireObject(body);
  const tierId = requireInt(body, 'tierId', { min: 1 });
  const quantity = requireInt(body, 'quantity', { min: 1, max: config.maxTicketsPerHold });
  const email = requireEmail(body, 'email');
  const name = requireString(body, 'name', { max: 120 });
  const now = clock.now();

  return transaction(db, () => {
    const event = getEvent(db, eventId);
    if (!event || event.status !== 'on_sale') throw notFound('event_not_on_sale');
    if (event.starts_at <= now.toISOString()) throw conflict('event_started');
    const tier = db.prepare('SELECT * FROM tiers WHERE id = ? AND event_id = ?').get(tierId, eventId);
    if (!tier) throw notFound('tier_not_found');

    const available = seatsLeft(db, tier.id);
    if (quantity > available) throw conflict('not_enough_seats', { available: Math.max(0, available) });

    const token = newToken();
    db.prepare(
      `INSERT INTO holds (token, event_id, tier_id, quantity, unit_price_cents, buyer_email, buyer_name,
                          status, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
    ).run(
      token,
      eventId,
      tier.id,
      quantity,
      tier.price_cents,
      email,
      name,
      addMinutes(now, config.holdMinutes).toISOString(),
      now.toISOString(),
    );
    return db.prepare('SELECT * FROM holds WHERE token = ?').get(token);
  });
}

export function getHold(db, token) {
  const hold = db.prepare('SELECT * FROM holds WHERE token = ?').get(token);
  if (!hold) throw notFound('hold_not_found');
  return hold;
}

// A buyer can give seats back before paying. A hold with a payment in flight can't be released.
export function releaseHold(db, token) {
  return transaction(db, () => {
    const hold = getHold(db, token);
    if (hold.status !== 'active') throw conflict('hold_not_active', { status: hold.status });
    const charging = db.prepare("SELECT 1 FROM orders WHERE hold_id = ? AND status = 'charging'").get(hold.id);
    if (charging) throw new HttpError(409, 'payment_in_progress');
    db.prepare("UPDATE holds SET status = 'released' WHERE id = ?").run(hold.id);
    return { ...hold, status: 'released' };
  });
}

// Run by the worker. Returns how many holds were expired.
export function expireHolds(db, now = new Date()) {
  const { changes } = db
    .prepare(
      `UPDATE holds SET status = 'expired'
       WHERE status = 'active' AND expires_at <= ?
         AND id NOT IN (SELECT hold_id FROM orders WHERE status = 'charging')`,
    )
    .run(now.toISOString());
  return changes;
}
