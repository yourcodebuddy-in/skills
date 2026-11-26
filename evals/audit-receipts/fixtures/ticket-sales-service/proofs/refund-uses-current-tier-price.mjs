// Refunds are priced from the tier's current price, not what the buyer paid. After a price change,
// buyers are refunded more (or less) than they were charged.
import { addOrganiser, buy, check, load, makeApp, onSaleEvent } from './lib.mjs';

const { ctx, call } = await makeApp();
const { runDueJobs } = await load('src/worker/run-jobs.js');
const { key } = await addOrganiser(ctx, 'harbour-hall');
const { eventId, tierIds } = await onSaleEvent(call, key);
const early = await buy(call, eventId, tierIds[0], { quantity: 2, email: 'early@example.test' });
const partial = await buy(call, eventId, tierIds[0], { quantity: 2, email: 'partial@example.test' });
check(early.subtotalCents === 5000 && early.totalCents === 5250, 'buyer paid 2 x 25.00 + 2.50 fee = 52.50');

const raised = await call('PATCH', `/events/${eventId}/tiers/${tierIds[0]}`, { key, body: { priceCents: 6000 } });
check(raised.status === 200, 'organiser raises the tier price to 60.00 for later sales (documented as allowed)');

const one = await call('POST', `/events/${eventId}/orders/${partial.token}/refunds`, { key, body: { quantity: 1 } });
check(one.status === 201, 'organiser refunds one ticket of an order bought at 25.00');
check(one.json.refund.amountCents === 6000, `that one ticket is refunded at ${one.json.refund.amountCents} cents, not 2500`);

await call('POST', `/events/${eventId}/cancel`, { key });
await runDueJobs(ctx);
const refundOfEarly = ctx.gateway.refunds.find((refund) => {
  const row = ctx.db.prepare('SELECT token FROM orders WHERE payment_id = ?').get(refund.paymentId);
  return row.token === early.token;
});
check(
  refundOfEarly.amountCents === 12_250 && early.totalCents === 5250,
  `on cancellation the order that paid 5250 is refunded ${refundOfEarly.amountCents}`,
);
