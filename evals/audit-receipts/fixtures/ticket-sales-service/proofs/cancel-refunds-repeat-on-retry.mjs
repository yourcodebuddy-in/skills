// A transient provider error part-way through refunding a cancelled event makes the job retry, and
// the retry refunds the orders that were already refunded, again, with no idempotency key.
import { addOrganiser, buy, check, fakeGateway, load, makeApp, onSaleEvent } from './lib.mjs';

const gateway = fakeGateway();
const { ctx, call } = await makeApp({ gateway });
const { runDueJobs } = await load('src/worker/run-jobs.js');
const { key } = await addOrganiser(ctx, 'harbour-hall');
const { eventId, tierIds } = await onSaleEvent(call, key);
const orders = [];
for (const email of ['a@example.test', 'b@example.test', 'c@example.test']) {
  orders.push(await buy(call, eventId, tierIds[0], { quantity: 1, email }));
}
const paymentIds = ctx.db.prepare('SELECT payment_id FROM orders ORDER BY id').all().map((row) => row.payment_id);

const realRefund = gateway.refund;
let failedOnce = false;
gateway.refund = async (request) => {
  if (request.paymentId === paymentIds[2] && !failedOnce) {
    failedOnce = true;
    throw new Error('payment provider answered 503');
  }
  return realRefund(request);
};

const cancel = await call('POST', `/events/${eventId}/cancel`, { key });
check(cancel.status === 200, 'event cancelled and refund job queued');

const first = await runDueJobs(ctx);
check(first.retried === 1, 'first run of the job failed on the third order and was scheduled for retry');
check(gateway.refunds.length === 2, 'two refunds had already been sent to the provider');
check(
  ctx.db.prepare("SELECT COUNT(*) AS n FROM orders WHERE status = 'paid'").get().n === 3,
  'none of them was recorded: all three orders still read as paid',
);

ctx.clock.advanceMinutes(5);
const second = await runDueJobs(ctx);
check(second.done === 1, 'the retry completed');
const perPayment = (id) => gateway.refunds.filter((refund) => refund.paymentId === id).length;
check(perPayment(paymentIds[0]) === 2 && perPayment(paymentIds[1]) === 2, 'the first two orders were refunded twice');
check(
  gateway.refunds.every((refund) => refund.idempotencyKey === undefined),
  'no idempotency key was sent with these refunds',
);
const refunded = gateway.refunds.reduce((sum, refund) => sum + refund.amountCents, 0);
const paid = orders.reduce((sum, order) => sum + order.totalCents, 0);
check(refunded > paid, `buyers got back ${refunded} cents for ${paid} cents paid`);
