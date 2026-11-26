import assert from 'node:assert/strict';
import { test } from 'node:test';
import { seatsLeft } from '../src/services/holds.js';
import { tick } from '../src/worker/index.js';
import { addOrganiser, buy, onSaleEvent, setup } from './helpers.js';

test('an organiser refunds part of an order and the seats go back on sale', async () => {
  const { ctx, call } = setup();
  const { key } = addOrganiser(ctx);
  const { eventId, tierIds } = await onSaleEvent(call, key);
  const { order } = await buy(call, eventId, tierIds[1], { quantity: 3 });

  const res = await call('POST', `/events/${eventId}/orders/${order.token}/refunds`, { key, body: { quantity: 1 } });
  assert.equal(res.status, 201);
  assert.equal(res.json.refund.amountCents, 4000);
  assert.equal(ctx.gateway.refunds.length, 1);

  const after = await call('GET', `/orders/${order.token}`);
  assert.equal(after.json.order.status, 'paid');
  assert.equal(after.json.order.refundedQuantity, 1);
  assert.equal(after.json.order.tickets.filter((ticket) => ticket.status === 'void').length, 1);
  assert.equal(seatsLeft(ctx.db, tierIds[1]), 18);
});

test('refunding every ticket marks the order refunded', async () => {
  const { ctx, call } = setup();
  const { key } = addOrganiser(ctx);
  const { eventId, tierIds } = await onSaleEvent(call, key);
  const { order } = await buy(call, eventId, tierIds[0], { quantity: 2 });

  await call('POST', `/events/${eventId}/orders/${order.token}/refunds`, { key, body: { quantity: 2 } });
  const again = await call('POST', `/events/${eventId}/orders/${order.token}/refunds`, { key, body: { quantity: 1 } });
  assert.equal(again.status, 409);
  assert.equal((await call('GET', `/orders/${order.token}`)).json.order.status, 'refunded');
});

test("an organiser can't refund another organiser's order", async () => {
  const { ctx, call } = setup();
  const first = addOrganiser(ctx, 'harbour-hall');
  const second = addOrganiser(ctx, 'mill-studio');
  const { eventId, tierIds } = await onSaleEvent(call, first.key);
  const { order } = await buy(call, eventId, tierIds[0]);

  const res = await call('POST', `/events/${eventId}/orders/${order.token}/refunds`, {
    key: second.key,
    body: { quantity: 1 },
  });
  assert.equal(res.status, 404);
  assert.equal(ctx.gateway.refunds.length, 0);
});

test('cancelling an event refunds every paid order in full through the worker', async () => {
  const { ctx, call } = setup();
  const { key } = addOrganiser(ctx);
  const { eventId, tierIds } = await onSaleEvent(call, key);
  const a = await buy(call, eventId, tierIds[0], { quantity: 2, email: 'a@example.test', name: 'A' });
  const b = await buy(call, eventId, tierIds[1], { quantity: 1, email: 'b@example.test', name: 'B' });

  const res = await call('POST', `/events/${eventId}/cancel`, { key });
  assert.equal(res.status, 200);
  assert.equal(res.json.event.status, 'cancelled');
  assert.equal(res.json.notified, 2);
  assert.deepEqual(
    ctx.mailer.sent.map((message) => message.to),
    ['a@example.test', 'b@example.test'],
  );

  await tick(ctx);
  assert.deepEqual(
    ctx.gateway.refunds.map((refund) => refund.amountCents),
    [a.order.totalCents, b.order.totalCents],
  );
  for (const { order } of [a, b]) {
    assert.equal((await call('GET', `/orders/${order.token}`)).json.order.status, 'refunded');
  }
});

test('a cancelled event stops selling', async () => {
  const { ctx, call } = setup();
  const { key } = addOrganiser(ctx);
  const { eventId, tierIds } = await onSaleEvent(call, key);
  await call('POST', `/events/${eventId}/cancel`, { key });

  const hold = await call('POST', `/public/events/${eventId}/holds`, {
    body: { tierId: tierIds[0], quantity: 1, email: 'c@example.test', name: 'C' },
  });
  assert.equal(hold.status, 404);
  assert.equal((await call('POST', `/events/${eventId}/cancel`, { key })).status, 409);
});
