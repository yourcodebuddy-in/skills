import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addOrganiser, onSaleEvent, setup } from './helpers.js';

async function holdFor(call, key, quantity = 2) {
  const { eventId, tierIds } = await onSaleEvent(call, key);
  const hold = await call('POST', `/public/events/${eventId}/holds`, {
    body: { tierId: tierIds[0], quantity, email: 'lin@example.test', name: 'Lin' },
  });
  return { eventId, tierIds, token: hold.json.hold.token };
}

test('checkout charges the hold price plus the booking fee and issues tickets', async () => {
  const { ctx, call } = setup();
  const { key } = addOrganiser(ctx);
  const { token } = await holdFor(call, key, 3);

  const res = await call('POST', `/holds/${token}/checkout`, { body: { paymentToken: 'tok_visa' } });
  assert.equal(res.status, 201);
  const { order } = res.json;
  assert.equal(order.status, 'paid');
  assert.equal(order.subtotalCents, 7500);
  assert.equal(order.feeCents, 375);
  assert.equal(order.totalCents, 7875);
  assert.equal(order.tickets.length, 3);
  assert.equal(ctx.gateway.charges.length, 1);
  assert.equal(ctx.gateway.charges[0].amountCents, 7875);

  const hold = ctx.db.prepare('SELECT status FROM holds WHERE token = ?').get(token);
  assert.equal(hold.status, 'converted');
});

test('the tickets email is queued in the outbox, not sent during the request', async () => {
  const { ctx, call } = setup();
  const { key } = addOrganiser(ctx);
  const { token } = await holdFor(call, key);
  const res = await call('POST', `/holds/${token}/checkout`, { body: { paymentToken: 'tok_visa' } });

  assert.equal(ctx.mailer.sent.length, 0);
  const queued = ctx.db.prepare('SELECT * FROM outbox').all();
  assert.equal(queued.length, 1);
  assert.equal(queued[0].kind, 'tickets');
  assert.equal(queued[0].recipient, 'lin@example.test');
  for (const ticket of res.json.order.tickets) assert.ok(queued[0].text_body.includes(ticket.code));
  assert.ok(queued[0].text_body.includes(`https://tickets.example.test/orders/${res.json.order.token}`));
});

test('paying twice for the same hold charges once', async () => {
  const { ctx, call } = setup();
  const { key } = addOrganiser(ctx);
  const { token } = await holdFor(call, key);

  const [first, second] = await Promise.all([
    call('POST', `/holds/${token}/checkout`, { body: { paymentToken: 'tok_visa' } }),
    call('POST', `/holds/${token}/checkout`, { body: { paymentToken: 'tok_visa' } }),
  ]);
  assert.deepEqual([first.status, second.status].sort(), [201, 409]);
  const again = await call('POST', `/holds/${token}/checkout`, { body: { paymentToken: 'tok_visa' } });
  assert.equal(again.status, 201);
  assert.equal(again.json.order.token, first.json.order.token);
  assert.equal(ctx.gateway.charges.length, 1);
});

test('a declined card can be retried with a new attempt', async () => {
  const { ctx, call } = setup();
  const { key } = addOrganiser(ctx);
  const { token } = await holdFor(call, key);

  const declined = await call('POST', `/holds/${token}/checkout`, { body: { paymentToken: 'tok_declined' } });
  assert.equal(declined.status, 402);
  assert.equal(declined.json.reason, 'card_declined');
  const paid = await call('POST', `/holds/${token}/checkout`, { body: { paymentToken: 'tok_visa' } });
  assert.equal(paid.status, 201);
  assert.match(ctx.gateway.charges[0].idempotencyKey, /-1$/);
});

test('an expired hold cannot be paid for', async () => {
  const { ctx, call } = setup();
  const { key } = addOrganiser(ctx);
  const { token } = await holdFor(call, key);
  ctx.clock.advanceMinutes(16);
  const res = await call('POST', `/holds/${token}/checkout`, { body: { paymentToken: 'tok_visa' } });
  assert.equal(res.status, 410);
  assert.equal(ctx.gateway.charges.length, 0);
});

test('a provider outage leaves the order ready for a retry with the same key', async () => {
  const { ctx, call } = setup();
  const { key } = addOrganiser(ctx);
  const { token } = await holdFor(call, key);
  const charge = ctx.gateway.charge;
  ctx.gateway.charge = async () => {
    throw new Error('socket hang up');
  };
  const failed = await call('POST', `/holds/${token}/checkout`, { body: { paymentToken: 'tok_visa' } });
  assert.equal(failed.status, 502);

  ctx.gateway.charge = charge;
  const paid = await call('POST', `/holds/${token}/checkout`, { body: { paymentToken: 'tok_visa' } });
  assert.equal(paid.status, 201);
  assert.match(ctx.gateway.charges[0].idempotencyKey, /-0$/);
});

test('a buyer reads their order by its link', async () => {
  const { ctx, call } = setup();
  const { key } = addOrganiser(ctx);
  const { token } = await holdFor(call, key);
  const paid = await call('POST', `/holds/${token}/checkout`, { body: { paymentToken: 'tok_visa' } });

  const res = await call('GET', `/orders/${paid.json.order.token}`);
  assert.equal(res.status, 200);
  assert.equal(res.json.order.tickets.length, 2);
  assert.equal((await call('GET', '/orders/0123456789abcdef0123456789abcdef')).status, 404);
});
