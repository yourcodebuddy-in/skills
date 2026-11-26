import { transaction } from '../db.js';
import { conflict, HttpError, notFound } from '../http/errors.js';
import { newToken, ticketCode } from '../lib/ids.js';
import { bookingFee } from '../lib/money.js';
import { requireObject, requireString } from '../lib/validate.js';
import { enqueueMail } from '../mail/outbox.js';
import { ticketsEmail } from '../mail/templates.js';
import { PaymentDeclinedError } from '../payments/gateway.js';

const SETTLED = new Set(['paid', 'refunded']);

export function serializeOrder(order, tickets = []) {
  return {
    token: order.token,
    eventId: order.event_id,
    tierId: order.tier_id,
    quantity: order.quantity,
    refundedQuantity: order.refunded_quantity,
    subtotalCents: order.subtotal_cents,
    feeCents: order.fee_cents,
    totalCents: order.total_cents,
    currency: order.currency,
    status: order.status,
    paidAt: order.paid_at,
    tickets: tickets.map((ticket) => ({ code: ticket.code, status: ticket.status })),
  };
}

export function getOrderByToken(db, token) {
  const order = db.prepare('SELECT * FROM orders WHERE token = ?').get(token);
  if (!order) throw notFound('order_not_found');
  const tickets = db.prepare('SELECT code, status FROM tickets WHERE order_id = ? ORDER BY id').all(order.id);
  return { order, tickets };
}

// Opens the order for a hold, or reuses the one already there, and marks it as charging. Runs in one
// write transaction, so only one request at a time can move an order to charging.
function startCharge(db, config, holdToken, stamp) {
  return transaction(db, () => {
    const hold = db.prepare('SELECT * FROM holds WHERE token = ?').get(holdToken);
    if (!hold) throw notFound('hold_not_found');
    let order = db.prepare('SELECT * FROM orders WHERE hold_id = ?').get(hold.id);
    if (order && SETTLED.has(order.status)) return order;
    if (order?.status === 'charging') throw conflict('payment_in_progress');
    if (hold.status !== 'active' || hold.expires_at <= stamp) throw new HttpError(410, 'hold_expired');

    if (!order) {
      const subtotal = hold.unit_price_cents * hold.quantity;
      const fee = bookingFee(subtotal, config.bookingFeeBps);
      db.prepare(
        `INSERT INTO orders (token, hold_id, event_id, tier_id, quantity, subtotal_cents, fee_cents, total_cents,
                             currency, buyer_email, buyer_name, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      ).run(
        newToken(),
        hold.id,
        hold.event_id,
        hold.tier_id,
        hold.quantity,
        subtotal,
        fee,
        subtotal + fee,
        config.currency,
        hold.buyer_email,
        hold.buyer_name,
        stamp,
      );
      order = db.prepare('SELECT * FROM orders WHERE hold_id = ?').get(hold.id);
    }

    // A declined card gets a fresh attempt number, so the provider treats the retry as a new charge.
    // After a timeout the number stays the same, so a retry can't charge twice.
    const attempt = order.status === 'failed' ? order.payment_attempt + 1 : order.payment_attempt;
    db.prepare("UPDATE orders SET status = 'charging', payment_attempt = ? WHERE id = ?").run(attempt, order.id);
    return { ...order, status: 'charging', payment_attempt: attempt };
  });
}

function completePayment(ctx, orderId, paymentId) {
  const { db, config, clock } = ctx;
  const stamp = clock.now().toISOString();
  return transaction(db, () => {
    const { changes } = db
      .prepare("UPDATE orders SET status = 'paid', payment_id = ?, paid_at = ? WHERE id = ? AND status = 'charging'")
      .run(paymentId, stamp, orderId);
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (changes === 0) return order;

    db.prepare("UPDATE holds SET status = 'converted' WHERE id = ?").run(order.hold_id);
    const insertTicket = db.prepare('INSERT INTO tickets (order_id, code, created_at) VALUES (?, ?, ?)');
    for (let i = 0; i < order.quantity; i += 1) insertTicket.run(order.id, ticketCode(), stamp);

    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(order.event_id);
    const tier = db.prepare('SELECT * FROM tiers WHERE id = ?').get(order.tier_id);
    const tickets = db.prepare('SELECT * FROM tickets WHERE order_id = ? ORDER BY id').all(order.id);
    enqueueMail(db, ticketsEmail({ order, event, tier, tickets, publicUrl: config.publicUrl }), clock.now());
    return order;
  });
}

export async function checkout(ctx, holdToken, body) {
  const { db, config, gateway, clock, log } = ctx;
  requireObject(body);
  const paymentToken = requireString(body, 'paymentToken', { max: 200 });
  const order = startCharge(db, config, holdToken, clock.now().toISOString());
  if (order.status !== 'charging') return order;

  let payment;
  try {
    payment = await gateway.charge({
      amountCents: order.total_cents,
      currency: order.currency,
      paymentToken,
      idempotencyKey: `${order.token}-${order.payment_attempt}`,
      description: `Order ${order.token.slice(0, 8)}`,
    });
  } catch (error) {
    const declined = error instanceof PaymentDeclinedError;
    db.prepare("UPDATE orders SET status = ? WHERE id = ? AND status = 'charging'").run(
      declined ? 'failed' : 'pending',
      order.id,
    );
    if (declined) throw new HttpError(402, 'payment_declined', { reason: error.reason });
    log.error('payment.charge_failed', { orderId: order.id, error: error.message });
    throw new HttpError(502, 'payment_unavailable');
  }
  return completePayment(ctx, order.id, payment.id);
}

// Puts the tickets email for a paid order back in the outbox.
export function resendTickets(ctx, orderToken) {
  const { db, config, clock } = ctx;
  const { order } = getOrderByToken(db, orderToken);
  if (order.status !== 'paid') throw conflict('order_not_paid', { status: order.status });
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(order.event_id);
  const tier = db.prepare('SELECT * FROM tiers WHERE id = ?').get(order.tier_id);
  const tickets = db.prepare("SELECT * FROM tickets WHERE order_id = ? AND status = 'valid' ORDER BY id").all(order.id);
  return enqueueMail(db, ticketsEmail({ order, event, tier, tickets, publicUrl: config.publicUrl }), clock.now());
}
