import { transaction } from '../db.js';
import { conflict, invalid, notFound } from '../http/errors.js';
import { enqueueJob } from '../jobs.js';
import {
  optionalInstant,
  optionalInt,
  optionalString,
  requireInstant,
  requireInt,
  requireObject,
  requireString,
} from '../lib/validate.js';
import { getTenantBySlug } from './tenants.js';

const MAX_TIERS = 12;
const MAX_CAPACITY = 100_000;
// The payment provider refuses charges under 0.50.
const MIN_PRICE_CENTS = 50;
const MAX_PRICE_CENTS = 1_000_000;

function readTier(input, index) {
  requireObject(input);
  const name = requireString(input, 'name', { max: 80 });
  const priceCents = requireInt(input, 'priceCents', { min: MIN_PRICE_CENTS, max: MAX_PRICE_CENTS });
  const capacity = requireInt(input, 'capacity', { min: 0, max: MAX_CAPACITY });
  return { name, priceCents, capacity, position: index };
}

export function serializeEvent(event, tiers = []) {
  return {
    id: event.id,
    title: event.title,
    venue: event.venue,
    startsAt: event.starts_at,
    status: event.status,
    cancelledAt: event.cancelled_at ?? null,
    tiers: tiers.map((tier) => ({
      id: tier.id,
      name: tier.name,
      priceCents: tier.price_cents,
      capacity: tier.capacity,
      ...(tier.remaining === undefined ? {} : { remaining: Math.max(0, tier.remaining) }),
    })),
  };
}

export function listTiers(db, eventId) {
  return db.prepare('SELECT * FROM tiers WHERE event_id = ? ORDER BY position, id').all(eventId);
}

export function getEvent(db, eventId) {
  return db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
}

export function getEventForTenant(db, tenantId, eventId) {
  const event = db.prepare('SELECT * FROM events WHERE id = ? AND tenant_id = ?').get(eventId, tenantId);
  if (!event) throw notFound('event_not_found');
  return event;
}

export function createEvent(db, tenantId, body, now = new Date()) {
  requireObject(body);
  const title = requireString(body, 'title', { max: 160 });
  const venue = requireString(body, 'venue', { max: 160 });
  const startsAt = requireInstant(body, 'startsAt');
  if (!Array.isArray(body.tiers) || body.tiers.length === 0) throw invalid('tiers', 'at least one tier');
  if (body.tiers.length > MAX_TIERS) throw invalid('tiers', `at most ${MAX_TIERS} tiers`);
  const tiers = body.tiers.map(readTier);
  const stamp = now.toISOString();

  return transaction(db, () => {
    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO events (tenant_id, title, venue, starts_at, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'draft', ?, ?)`,
      )
      .run(tenantId, title, venue, startsAt, stamp, stamp);
    const eventId = Number(lastInsertRowid);
    const insertTier = db.prepare(
      'INSERT INTO tiers (event_id, name, price_cents, capacity, position) VALUES (?, ?, ?, ?, ?)',
    );
    for (const tier of tiers) insertTier.run(eventId, tier.name, tier.priceCents, tier.capacity, tier.position);
    return eventId;
  });
}

export function listEvents(db, tenantId) {
  return db.prepare('SELECT * FROM events WHERE tenant_id = ? ORDER BY starts_at, id').all(tenantId);
}

export function updateEvent(db, tenantId, eventId, body, now = new Date()) {
  requireObject(body);
  const event = getEventForTenant(db, tenantId, eventId);
  if (event.status === 'cancelled') throw conflict('event_cancelled');
  const title = optionalString(body, 'title', { max: 160 }) ?? event.title;
  const venue = optionalString(body, 'venue', { max: 160 }) ?? event.venue;
  const startsAt = optionalInstant(body, 'startsAt') ?? event.starts_at;
  db.prepare('UPDATE events SET title = ?, venue = ?, starts_at = ?, updated_at = ? WHERE id = ?').run(
    title,
    venue,
    startsAt,
    now.toISOString(),
    eventId,
  );
  return getEventForTenant(db, tenantId, eventId);
}

export function publishEvent(db, tenantId, eventId, now = new Date()) {
  const event = getEventForTenant(db, tenantId, eventId);
  if (event.status !== 'draft') throw conflict('event_not_draft', { status: event.status });
  if (event.starts_at <= now.toISOString()) throw conflict('event_in_past');
  db.prepare("UPDATE events SET status = 'on_sale', updated_at = ? WHERE id = ?").run(now.toISOString(), eventId);
  return getEventForTenant(db, tenantId, eventId);
}

export function addTier(db, tenantId, eventId, body) {
  const event = getEventForTenant(db, tenantId, eventId);
  if (event.status === 'cancelled') throw conflict('event_cancelled');
  const count = db.prepare('SELECT COUNT(*) AS n FROM tiers WHERE event_id = ?').get(eventId).n;
  if (count >= MAX_TIERS) throw conflict('too_many_tiers');
  const tier = readTier(body, count);
  const { lastInsertRowid } = db
    .prepare('INSERT INTO tiers (event_id, name, price_cents, capacity, position) VALUES (?, ?, ?, ?, ?)')
    .run(eventId, tier.name, tier.priceCents, tier.capacity, tier.position);
  return db.prepare('SELECT * FROM tiers WHERE id = ?').get(Number(lastInsertRowid));
}

// Price changes apply to holds made afterwards. Capacity can't drop below what is already sold or held.
export function updateTier(db, tenantId, eventId, tierId, body) {
  requireObject(body);
  const event = getEventForTenant(db, tenantId, eventId);
  if (event.status === 'cancelled') throw conflict('event_cancelled');
  const tier = db.prepare('SELECT * FROM tiers WHERE id = ? AND event_id = ?').get(tierId, eventId);
  if (!tier) throw notFound('tier_not_found');

  const name = optionalString(body, 'name', { max: 80 }) ?? tier.name;
  const priceCents = optionalInt(body, 'priceCents', { min: MIN_PRICE_CENTS, max: MAX_PRICE_CENTS }) ?? tier.price_cents;
  const capacity = optionalInt(body, 'capacity', { min: 0, max: MAX_CAPACITY }) ?? tier.capacity;

  return transaction(db, () => {
    const taken = db
      .prepare(
        `SELECT
           COALESCE((SELECT SUM(quantity - refunded_quantity) FROM orders WHERE tier_id = ? AND status = 'paid'), 0)
         + COALESCE((SELECT SUM(quantity) FROM holds WHERE tier_id = ? AND status = 'active'), 0) AS n`,
      )
      .get(tierId, tierId).n;
    if (capacity < taken) throw conflict('capacity_below_sold', { taken });
    db.prepare('UPDATE tiers SET name = ?, price_cents = ?, capacity = ? WHERE id = ?').run(
      name,
      priceCents,
      capacity,
      tierId,
    );
    return db.prepare('SELECT * FROM tiers WHERE id = ?').get(tierId);
  });
}

// Cancelling stops sales, releases open holds and queues refunds for every paid order.
// Returns the buyers to tell.
export function cancelEvent(db, tenantId, eventId, now = new Date()) {
  return transaction(db, () => {
    const event = getEventForTenant(db, tenantId, eventId);
    if (event.status === 'cancelled') throw conflict('event_cancelled');
    const stamp = now.toISOString();
    db.prepare("UPDATE events SET status = 'cancelled', cancelled_at = ?, updated_at = ? WHERE id = ?").run(
      stamp,
      stamp,
      eventId,
    );
    db.prepare(
      `UPDATE holds SET status = 'released'
       WHERE event_id = ? AND status = 'active'
         AND id NOT IN (SELECT hold_id FROM orders WHERE status = 'charging')`,
    ).run(eventId);
    const buyers = db
      .prepare(
        `SELECT DISTINCT buyer_email AS email, buyer_name AS name FROM orders
         WHERE event_id = ? AND status = 'paid' ORDER BY buyer_email`,
      )
      .all(eventId);
    if (buyers.length > 0) enqueueJob(db, 'refund_event', { eventId }, now);
    return { event: getEventForTenant(db, tenantId, eventId), buyers };
  });
}

// What buyers see: an organiser's on-sale events that haven't started, with seats left per tier.
export function listPublicEvents(db, tenantSlug, now = new Date()) {
  const tenant = getTenantBySlug(db, tenantSlug);
  const stamp = now.toISOString();
  const events = db
    .prepare(
      `SELECT * FROM events WHERE tenant_id = ? AND status = 'on_sale' AND starts_at > ?
       ORDER BY starts_at, id`,
    )
    .all(tenant.id, stamp);
  const tiersFor = db.prepare(
    `SELECT t.*,
       t.capacity
       - COALESCE((SELECT SUM(o.quantity) FROM orders o
                   WHERE o.tier_id = t.id AND o.status IN ('paid', 'refunded')), 0)
       - COALESCE((SELECT SUM(h.quantity) FROM holds h
                   WHERE h.tier_id = t.id AND h.status = 'active' AND h.expires_at > ?), 0) AS remaining
     FROM tiers t WHERE t.event_id = ? ORDER BY t.position, t.id`,
  );
  return {
    organiser: { name: tenant.name, slug: tenant.slug },
    events: events.map((event) => serializeEvent(event, tiersFor.all(stamp, event.id))),
  };
}
