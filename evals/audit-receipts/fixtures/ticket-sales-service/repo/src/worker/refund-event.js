import { transaction } from '../db.js';
import { planRefund, recordRefund } from '../services/refunds.js';

// Job `refund_event`: refunds every paid order of a cancelled event in full, booking fee included.
export async function refundEvent(ctx, { eventId }) {
  const { db, gateway, clock, log } = ctx;
  const orders = db
    .prepare("SELECT id, quantity, refunded_quantity FROM orders WHERE event_id = ? AND status = 'paid' ORDER BY id")
    .all(eventId);

  const issued = [];
  for (const order of orders) {
    const plan = planRefund(db, order.id, order.quantity - order.refunded_quantity, 'event_cancelled');
    const refund = await gateway.refund({ paymentId: plan.paymentId, amountCents: plan.amountCents });
    issued.push({ plan, providerRef: refund.id });
  }

  const now = clock.now();
  transaction(db, () => {
    for (const { plan, providerRef } of issued) recordRefund(db, plan, providerRef, now);
  });
  log.info('refunds.event_refunded', { eventId, orders: issued.length });
  return issued.length;
}
