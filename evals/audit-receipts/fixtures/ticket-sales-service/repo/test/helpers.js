import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { openDatabase } from '../src/db.js';
import { silentLogger } from '../src/log.js';
import { migrate } from '../src/migrate.js';
import { PaymentDeclinedError } from '../src/payments/gateway.js';
import { createApiKey, createTenant } from '../src/services/tenants.js';

export const START = new Date('2026-05-01T10:00:00.000Z');

export function fakeClock(start = START) {
  let current = new Date(start);
  return {
    now: () => new Date(current),
    advanceMinutes(minutes) {
      current = new Date(current.getTime() + minutes * 60_000);
    },
    set(date) {
      current = new Date(date);
    },
  };
}

// Records charges and refunds. Charges with a payment token of "tok_declined" are declined.
export function fakeGateway() {
  const gateway = {
    charges: [],
    refunds: [],
    async charge(request) {
      if (request.paymentToken === 'tok_declined') throw new PaymentDeclinedError('card_declined');
      const id = `ch_${gateway.charges.length + 1}`;
      gateway.charges.push({ id, ...request });
      return { id };
    },
    async refund(request) {
      const id = `re_${gateway.refunds.length + 1}`;
      gateway.refunds.push({ id, ...request });
      return { id };
    },
  };
  return gateway;
}

export function fakeMailer() {
  const mailer = {
    sent: [],
    async send(message) {
      mailer.sent.push(message);
    },
  };
  return mailer;
}

export function testContext(overrides = {}) {
  const config = loadConfig({
    PAYMENTS_WEBHOOK_SECRET: 'whsec_test',
    PUBLIC_URL: 'https://tickets.example.test',
    ...overrides.env,
  });
  const db = openDatabase(':memory:');
  migrate(db);
  return {
    config,
    db,
    log: silentLogger,
    clock: overrides.clock ?? fakeClock(),
    gateway: overrides.gateway ?? fakeGateway(),
    mailer: overrides.mailer ?? fakeMailer(),
  };
}

export function setup(overrides) {
  const ctx = testContext(overrides);
  const app = createApp(ctx);
  const call = async (method, url, { body, key, headers = {} } = {}) => {
    const response = await app.handle({
      method,
      url,
      headers: { ...(key ? { authorization: `Bearer ${key}` } : {}), ...headers },
      body: body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body),
    });
    const isJson = response.headers['content-type']?.startsWith('application/json');
    return { ...response, json: isJson && response.body ? JSON.parse(response.body) : undefined };
  };
  return { ctx, app, call };
}

export function addOrganiser(ctx, slug = 'harbour-hall', timezone = 'Europe/London') {
  const tenant = createTenant(ctx.db, { name: `${slug} venue`, slug, timezone }, ctx.clock.now());
  const { key } = createApiKey(ctx.db, tenant.id, 'tests', ctx.clock.now());
  return { tenant, key };
}

export const sampleEvent = (overrides = {}) => ({
  title: 'Late Night Jazz',
  venue: 'Harbour Hall',
  startsAt: '2026-06-12T19:30:00Z',
  tiers: [
    { name: 'Standing', priceCents: 2500, capacity: 100 },
    { name: 'Balcony', priceCents: 4000, capacity: 20 },
  ],
  ...overrides,
});

// Creates and publishes an event, returning its id and tier ids.
export async function onSaleEvent(call, key, overrides) {
  const created = await call('POST', '/events', { key, body: sampleEvent(overrides) });
  if (created.status !== 201) throw new Error(`create failed: ${created.body}`);
  const { id, tiers } = created.json.event;
  const published = await call('POST', `/events/${id}/publish`, { key });
  if (published.status !== 200) throw new Error(`publish failed: ${published.body}`);
  return { eventId: id, tierIds: tiers.map((tier) => tier.id) };
}

export async function buy(call, eventId, tierId, { quantity = 2, email = 'ada@example.test', name = 'Ada' } = {}) {
  const hold = await call('POST', `/public/events/${eventId}/holds`, { body: { tierId, quantity, email, name } });
  if (hold.status !== 201) throw new Error(`hold failed: ${hold.body}`);
  const order = await call('POST', `/holds/${hold.json.hold.token}/checkout`, { body: { paymentToken: 'tok_visa' } });
  if (order.status !== 201) throw new Error(`checkout failed: ${order.body}`);
  return { hold: hold.json.hold, order: order.json.order };
}
