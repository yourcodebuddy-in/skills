import assert from 'node:assert/strict';
import { test } from 'node:test';
import { expireHolds, seatsLeft } from '../src/services/holds.js';
import { addOrganiser, onSaleEvent, setup } from './helpers.js';

const holdBody = (tierId, quantity = 2) => ({ tierId, quantity, email: 'Grace@Example.test', name: 'Grace' });

test('a hold takes seats for the configured number of minutes', async () => {
  const { ctx, call } = setup({ env: { HOLD_MINUTES: '7' } });
  const { key } = addOrganiser(ctx);
  const { eventId, tierIds } = await onSaleEvent(call, key);

  const res = await call('POST', `/public/events/${eventId}/holds`, { body: holdBody(tierIds[1], 5) });
  assert.equal(res.status, 201);
  assert.equal(res.json.hold.expiresAt, '2026-05-01T10:07:00.000Z');
  assert.equal(res.json.hold.token.length, 32);
  assert.equal(seatsLeft(ctx.db, tierIds[1]), 15);
});

test('a hold cannot take more seats than are left', async () => {
  const { ctx, call } = setup();
  const { key } = addOrganiser(ctx);
  const { eventId, tierIds } = await onSaleEvent(call, key);
  for (let i = 0; i < 2; i += 1) await call('POST', `/public/events/${eventId}/holds`, { body: holdBody(tierIds[1], 8) });

  const res = await call('POST', `/public/events/${eventId}/holds`, { body: holdBody(tierIds[1], 5) });
  assert.equal(res.status, 409);
  assert.equal(res.json.error, 'not_enough_seats');
  assert.equal(res.json.available, 4);
});

test('a hold is limited to the per-hold maximum', async () => {
  const { ctx, call } = setup();
  const { key } = addOrganiser(ctx);
  const { eventId, tierIds } = await onSaleEvent(call, key);
  const res = await call('POST', `/public/events/${eventId}/holds`, { body: holdBody(tierIds[0], 9) });
  assert.equal(res.status, 422);
  assert.equal(res.json.field, 'quantity');
});

test('holds are only taken for on-sale events and their own tiers', async () => {
  const { ctx, call } = setup();
  const { key } = addOrganiser(ctx);
  const draft = await call('POST', '/events', {
    key,
    body: { title: 'Draft', venue: 'Hall', startsAt: '2026-07-01T18:00:00Z', tiers: [{ name: 'A', priceCents: 1000, capacity: 5 }] },
  });
  const { eventId } = await onSaleEvent(call, key);

  const onDraft = await call('POST', `/public/events/${draft.json.event.id}/holds`, {
    body: holdBody(draft.json.event.tiers[0].id),
  });
  assert.equal(onDraft.status, 404);
  const wrongTier = await call('POST', `/public/events/${eventId}/holds`, { body: holdBody(draft.json.event.tiers[0].id) });
  assert.equal(wrongTier.status, 404);
});

test('expired holds give their seats back when the worker runs', async () => {
  const { ctx, call } = setup();
  const { key } = addOrganiser(ctx);
  const { eventId, tierIds } = await onSaleEvent(call, key);
  await call('POST', `/public/events/${eventId}/holds`, { body: holdBody(tierIds[1], 6) });

  ctx.clock.advanceMinutes(30);
  assert.equal(seatsLeft(ctx.db, tierIds[1]), 14);
  assert.equal(expireHolds(ctx.db, ctx.clock.now()), 1);
  assert.equal(seatsLeft(ctx.db, tierIds[1]), 20);
});

test('a buyer can release a hold', async () => {
  const { ctx, call } = setup();
  const { key } = addOrganiser(ctx);
  const { eventId, tierIds } = await onSaleEvent(call, key);
  const hold = await call('POST', `/public/events/${eventId}/holds`, { body: holdBody(tierIds[1], 6) });

  const res = await call('DELETE', `/holds/${hold.json.hold.token}`);
  assert.equal(res.status, 204);
  assert.equal(seatsLeft(ctx.db, tierIds[1]), 20);
  assert.equal((await call('DELETE', `/holds/${hold.json.hold.token}`)).status, 409);
});

test('buyer emails are stored in lower case', async () => {
  const { ctx, call } = setup();
  const { key } = addOrganiser(ctx);
  const { eventId, tierIds } = await onSaleEvent(call, key);
  const hold = await call('POST', `/public/events/${eventId}/holds`, { body: holdBody(tierIds[0]) });
  const row = ctx.db.prepare('SELECT buyer_email FROM holds WHERE token = ?').get(hold.json.hold.token);
  assert.equal(row.buyer_email, 'grace@example.test');
});
