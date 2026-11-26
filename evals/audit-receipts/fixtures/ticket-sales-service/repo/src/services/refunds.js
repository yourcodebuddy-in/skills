import { transaction } from '../db.js';
import { conflict, notFound } from '../http/errors.js';
import { requireInt, requireObject } from '../lib/validate.js';
import { enqueueMail } from '../mail/outbox.js';
import { refundEmail } from '../mail/templates.js';
import { getEventForTenant } from './events.js';

// Works out what refunding `quantity` of an order's tickets returns to the buyer. The booking fee is
// returned only when the event is cancelled and every remaining ticket is refunded.
export function planRefund(db, orderId, quantity, reason) {
  const row = db
    .prepare(
      `SELECT o.*, t.price_cents, t.name AS tier_name, e.title AS event_title
       FROM orders o
       JOIN tiers t ON t.id = o.tier_id
       JOIN events e ON e.id = o.event_id
       WHERE o.id = ?`,
    )
    .get(orderId);
  if (!row) throw notFound('order_not_found');
  if (row.status !== 'paid') throw conflict('order_not_refundable', { status: row.status });
  const remaining = row.quantity - row.refunded_quantity;
  if (quantity < 1 || quantity > remaining) throw conflict('refund_quantity_too_large', { remaining });

  let amountCents = quantity * row.price_cents;
  if (reason === 'event_cancelled' && quantity === remaining) amountCents += row.fee_cents;

  return {
    orderId: row.id,
    orderToken: row.token,
    paymentId: row.payment_id,
    alreadyRefunded: row.refunded_quantity,
    quantity,
    amountCents,
    currency: row.currency,
    reason,
    buyerEmail: row.buyer_email,
    buyerName: row.buyer_name,
    eventTitle: row.event_title,
    tierName: row.tier_name,
  };
}

// Records a refund the provider has made: the refund row, the order's refunded count, the voided
// tickets and the email to the buyer. Call inside a transaction.
export function recordRefund(db, plan, providerRef, now = new Date()) {
  const stamp = now.toISOString();
  db.prepare(
    `INSERT INTO refunds (order_id, quantity, amount_cents, reason, provider_ref, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(plan.orderId, plan.quantity, plan.amountCents, plan.reason, providerRef, stamp);
  db.prepare(
    `UPDATE orders SET refunded_quantity = refunded_quantity + ?,
       status = CASE WHEN refunded_quantity + ? >= quantity THEN 'refunded' ELSE status END
     WHERE id = ?`,
  ).run(plan.quantity, plan.quantity, plan.orderId);
  db.prepare(
    `UPDATE tickets SET status = 'void' WHERE id IN (
       SELECT id FROM tickets WHERE order_id = ? AND status = 'valid' ORDER BY id DESC LIMIT ?)`,
  ).run(plan.orderId, plan.quantity);
  enqueueMail(db, refundEmail(plan), now);
}

// An organiser refunds some or all of one order's tickets. The seats go back on sale.
export async function refundTickets(ctx, tenantId, eventId, orderToken, body) {
  const { db, gateway, clock } = ctx;
  requireObject(body);
  const quantity = requireInt(body, 'quantity', { min: 1 });
  getEventForTenant(db, tenantId, eventId);
  const order = db.prepare('SELECT id FROM orders WHERE token = ? AND event_id = ?').get(orderToken, eventId);
  if (!order) throw notFound('order_not_found');

  const plan = planRefund(db, order.id, quantity, 'organiser');
  const refund = await gateway.refund({
    paymentId: plan.paymentId,
    amountCents: plan.amountCents,
    idempotencyKey: `${plan.orderToken}-refund-${plan.alreadyRefunded}`,
  });
  transaction(db, () => recordRefund(db, plan, refund.id, clock.now()));
  return { orderToken, quantity, amountCents: plan.amountCents, providerRef: refund.id };
}

// A refund made in the provider's dashboard reaches us as a webhook. Refunds we made ourselves come
// back the same way and are recognised by their provider reference.
export function applyProviderRefund(db, data, now = new Date()) {
  const order = db.prepare('SELECT * FROM orders WHERE payment_id = ?').get(data.paymentId);
  if (!order) return null;
  if (db.prepare('SELECT 1 FROM refunds WHERE provider_ref = ?').get(data.refundId)) {
    return { orderToken: order.token, duplicate: true };
  }
  if (order.status !== 'paid' || !Number.isSafeInteger(data.amountCents) || data.amountCents < 1) {
    return { orderToken: order.token, ignored: true };
  }
  const plan = {
    orderId: order.id,
    quantity: data.full ? order.quantity - order.refunded_quantity : 0,
    amountCents: data.amountCents,
    currency: order.currency,
    reason: 'provider',
    buyerEmail: order.buyer_email,
    buyerName: order.buyer_name,
    eventTitle: db.prepare('SELECT title FROM events WHERE id = ?').get(order.event_id).title,
  };
  transaction(db, () => recordRefund(db, plan, data.refundId, now));
  return { orderToken: order.token, recorded: true };
}
