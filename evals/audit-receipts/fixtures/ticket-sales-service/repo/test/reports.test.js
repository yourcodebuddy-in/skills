import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addOrganiser, buy, onSaleEvent, setup } from './helpers.js';

test('the sales report counts tickets and money per event', async () => {
  const { ctx, call } = setup();
  const { key } = addOrganiser(ctx);
  const { eventId, tierIds } = await onSaleEvent(call, key);
  await buy(call, eventId, tierIds[0], { quantity: 2 });
  const { order } = await buy(call, eventId, tierIds[1], { quantity: 2, email: 'b@example.test' });
  await call('POST', `/events/${eventId}/orders/${order.token}/refunds`, { key, body: { quantity: 1 } });

  const res = await call('GET', `/events/${eventId}/report`, { key });
  assert.equal(res.status, 200);
  const report = res.json;
  assert.deepEqual(
    report.tiers.map((tier) => tier.sold),
    [2, 1],
  );
  assert.equal(report.orders, 2);
  assert.equal(report.grossCents, 5250 + 8400);
  assert.equal(report.refundedCents, 4000);
  assert.equal(report.netCents, 5250 + 8400 - 4000);
  assert.deepEqual(report.display, { gross: '€136.50', refunded: '€-40.00', net: '€96.50' });
});

test('the report groups orders by the organiser’s local day', async () => {
  const { ctx, call } = setup();
  const { key } = addOrganiser(ctx, 'harbour-hall', 'Europe/London');
  const { eventId, tierIds } = await onSaleEvent(call, key);
  ctx.clock.set('2026-05-01T22:30:00Z');
  await buy(call, eventId, tierIds[0], { quantity: 1 });
  ctx.clock.set('2026-05-01T23:30:00Z');
  await buy(call, eventId, tierIds[0], { quantity: 2, email: 'late@example.test' });

  const { byDay } = (await call('GET', `/events/${eventId}/report`, { key })).json;
  assert.deepEqual(byDay, [
    { day: '2026-05-01', orders: 1, tickets: 1 },
    { day: '2026-05-02', orders: 1, tickets: 2 },
  ]);
});

test('orders can be listed, filtered and sorted', async () => {
  const { ctx, call } = setup();
  const { key } = addOrganiser(ctx);
  const { eventId, tierIds } = await onSaleEvent(call, key);
  await buy(call, eventId, tierIds[0], { quantity: 1, name: 'Bea', email: 'bea@example.test' });
  await buy(call, eventId, tierIds[1], { quantity: 2, name: 'Abe', email: 'abe@example.test' });

  const byTotal = await call('GET', `/events/${eventId}/orders?sort=total&dir=asc`, { key });
  assert.deepEqual(
    byTotal.json.orders.map((order) => order.buyerName),
    ['Bea', 'Abe'],
  );
  const byBuyer = await call('GET', `/events/${eventId}/orders?sort=buyer&dir=asc`, { key });
  assert.deepEqual(
    byBuyer.json.orders.map((order) => order.buyerName),
    ['Abe', 'Bea'],
  );
  const failed = await call('GET', `/events/${eventId}/orders?status=failed`, { key });
  assert.equal(failed.json.orders.length, 0);
  const unknown = await call('GET', `/events/${eventId}/orders?status=lost`, { key });
  assert.equal(unknown.status, 422);
});

test('the CSV export lists paid orders with local times', async () => {
  const { ctx, call } = setup();
  const { key } = addOrganiser(ctx, 'harbour-hall', 'Europe/London');
  const { eventId, tierIds } = await onSaleEvent(call, key);
  await buy(call, eventId, tierIds[0], { quantity: 2, name: 'Smith, Jo', email: 'jo@example.test' });

  const res = await call('GET', `/events/${eventId}/orders.csv`, { key });
  assert.equal(res.status, 200);
  assert.equal(res.headers['content-disposition'], 'attachment; filename="late-night-jazz-orders.csv"');
  const [header, row] = res.body.trim().split('\r\n');
  assert.equal(header, 'Order,Paid at,Name,Email,Tier,Tickets,Refunded tickets,Total,Status');
  assert.match(row, /,2026-05-01 11:00,"Smith, Jo",jo@example.test,Standing,2,0,52.50,paid$/);
});

test('the CSV export needs an API key', async () => {
  const { ctx, call } = setup();
  const { key } = addOrganiser(ctx);
  const { eventId } = await onSaleEvent(call, key);
  assert.equal((await call('GET', `/events/${eventId}/orders.csv`)).status, 401);
});
