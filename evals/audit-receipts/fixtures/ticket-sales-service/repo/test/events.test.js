import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addOrganiser, buy, onSaleEvent, sampleEvent, setup } from './helpers.js';

test('an organiser creates a draft event with tiers', async () => {
  const { ctx, call } = setup();
  const { key } = addOrganiser(ctx);
  const res = await call('POST', '/events', { key, body: sampleEvent() });
  assert.equal(res.status, 201);
  assert.equal(res.json.event.status, 'draft');
  assert.deepEqual(
    res.json.event.tiers.map((tier) => [tier.name, tier.priceCents, tier.capacity]),
    [
      ['Standing', 2500, 100],
      ['Balcony', 4000, 20],
    ],
  );
});

test('requests without a valid API key are refused', async () => {
  const { ctx, call } = setup();
  addOrganiser(ctx);
  assert.equal((await call('GET', '/events')).status, 401);
  assert.equal((await call('GET', '/events', { key: 'bo_00000000_aaaaaaaaaaaaaaaaaaaaaaaa' })).status, 401);
});

test('event input is validated', async () => {
  const { ctx, call } = setup();
  const { key } = addOrganiser(ctx);
  const noTiers = await call('POST', '/events', { key, body: sampleEvent({ tiers: [] }) });
  assert.equal(noTiers.status, 422);
  assert.equal(noTiers.json.field, 'tiers');
  const localTime = await call('POST', '/events', { key, body: sampleEvent({ startsAt: '2026-06-12 19:30' }) });
  assert.equal(localTime.status, 422);
  assert.equal(localTime.json.field, 'startsAt');
  const cheap = await call('POST', '/events', {
    key,
    body: sampleEvent({ tiers: [{ name: 'Free', priceCents: 0, capacity: 10 }] }),
  });
  assert.equal(cheap.status, 422);
});

test("an organiser can't see or change another organiser's events", async () => {
  const { ctx, call } = setup();
  const first = addOrganiser(ctx, 'harbour-hall');
  const second = addOrganiser(ctx, 'mill-studio');
  const { eventId } = await onSaleEvent(call, first.key);

  assert.equal((await call('GET', `/events/${eventId}`, { key: second.key })).status, 404);
  assert.equal((await call('PATCH', `/events/${eventId}`, { key: second.key, body: { title: 'Mine' } })).status, 404);
  assert.equal((await call('POST', `/events/${eventId}/cancel`, { key: second.key })).status, 404);
  assert.equal((await call('GET', `/events/${eventId}/report`, { key: second.key })).status, 404);
  assert.equal((await call('GET', '/events', { key: second.key })).json.events.length, 0);
});

test('an event in the past cannot be published', async () => {
  const { ctx, call } = setup();
  const { key } = addOrganiser(ctx);
  const created = await call('POST', '/events', { key, body: sampleEvent({ startsAt: '2026-04-01T19:00:00Z' }) });
  const res = await call('POST', `/events/${created.json.event.id}/publish`, { key });
  assert.equal(res.status, 409);
  assert.equal(res.json.error, 'event_in_past');
});

test('the public listing shows on-sale events with seats left', async () => {
  const { ctx, call } = setup();
  const { key } = addOrganiser(ctx);
  const { eventId, tierIds } = await onSaleEvent(call, key);
  await call('POST', '/events', { key, body: sampleEvent({ title: 'Still a draft' }) });
  await buy(call, eventId, tierIds[1], { quantity: 3 });

  const res = await call('GET', '/public/harbour-hall/events');
  assert.equal(res.status, 200);
  assert.equal(res.json.events.length, 1);
  assert.deepEqual(
    res.json.events[0].tiers.map((tier) => tier.remaining),
    [100, 17],
  );
});

test('capacity cannot drop below tickets already sold', async () => {
  const { ctx, call } = setup();
  const { key } = addOrganiser(ctx);
  const { eventId, tierIds } = await onSaleEvent(call, key);
  await buy(call, eventId, tierIds[1], { quantity: 4 });

  const tooLow = await call('PATCH', `/events/${eventId}/tiers/${tierIds[1]}`, { key, body: { capacity: 3 } });
  assert.equal(tooLow.status, 409);
  const ok = await call('PATCH', `/events/${eventId}/tiers/${tierIds[1]}`, { key, body: { capacity: 4 } });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.tier.capacity, 4);
});

test('a price change applies to holds made afterwards', async () => {
  const { ctx, call } = setup();
  const { key } = addOrganiser(ctx);
  const { eventId, tierIds } = await onSaleEvent(call, key);
  const before = await call('POST', `/public/events/${eventId}/holds`, {
    body: { tierId: tierIds[0], quantity: 1, email: 'a@example.test', name: 'A' },
  });
  await call('PATCH', `/events/${eventId}/tiers/${tierIds[0]}`, { key, body: { priceCents: 3000 } });
  const after = await call('POST', `/public/events/${eventId}/holds`, {
    body: { tierId: tierIds[0], quantity: 1, email: 'b@example.test', name: 'B' },
  });
  assert.equal(before.json.hold.unitPriceCents, 2500);
  assert.equal(after.json.hold.unitPriceCents, 3000);
});
