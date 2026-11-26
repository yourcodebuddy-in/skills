import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sign } from '../src/payments/webhook.js';
import { addOrganiser, buy, onSaleEvent, setup } from './helpers.js';

const SECRET = 'whsec_test';

const deliver = (call, payload, signature) => {
  const body = JSON.stringify(payload);
  return call('POST', '/webhooks/payments', {
    body,
    headers: { 'x-payments-signature': signature ?? sign(body, SECRET) },
  });
};

async function paidOrder(ctx, call) {
  const { key } = addOrganiser(ctx);
  const { eventId, tierIds } = await onSaleEvent(call, key);
  const { order } = await buy(call, eventId, tierIds[0], { quantity: 2 });
  const { payment_id: paymentId } = ctx.db.prepare('SELECT payment_id FROM orders WHERE token = ?').get(order.token);
  return { order, paymentId };
}

test('a refund made in the provider dashboard is recorded', async () => {
  const { ctx, call } = setup();
  const { order, paymentId } = await paidOrder(ctx, call);

  const res = await deliver(call, {
    type: 'charge.refunded',
    data: { paymentId, refundId: 're_dash_1', amountCents: order.totalCents, full: true },
  });
  assert.equal(res.status, 200);
  assert.equal(res.json.recorded, true);
  const after = (await call('GET', `/orders/${order.token}`)).json.order;
  assert.equal(after.status, 'refunded');
  assert.ok(after.tickets.every((ticket) => ticket.status === 'void'));
});

test('a repeated webhook is recorded once', async () => {
  const { ctx, call } = setup();
  const { paymentId } = await paidOrder(ctx, call);
  const payload = { type: 'charge.refunded', data: { paymentId, refundId: 're_dash_2', amountCents: 500 } };

  await deliver(call, payload);
  const second = await deliver(call, payload);
  assert.equal(second.json.duplicate, true);
  assert.equal(ctx.db.prepare('SELECT COUNT(*) AS n FROM refunds').get().n, 1);
});

test('events that do not need handling are acknowledged', async () => {
  const { call } = setup();
  const res = await deliver(call, { type: 'charge.succeeded', data: { paymentId: 'ch_1' } });
  assert.equal(res.status, 202);
});

test('an event with a bad signature is rejected', async () => {
  const { call } = setup();
  const res = await deliver(
    call,
    { type: 'charge.refunded', data: { paymentId: 'ch_404', refundId: 're_x', amountCents: 100, full: true } },
    'f'.repeat(64),
  );
  assert.notEqual(res.status, 200);
});

test('a malformed body is rejected', async () => {
  const { call } = setup();
  const body = '{"type":';
  const res = await call('POST', '/webhooks/payments', { body, headers: { 'x-payments-signature': sign(body, SECRET) } });
  assert.equal(res.status, 400);
});
