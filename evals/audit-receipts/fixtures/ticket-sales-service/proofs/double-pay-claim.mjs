// README: "A buyer is never charged twice for one hold, even if they press Pay twice or two app
// servers take the two requests." True: the order is unique per hold, and moving it to `charging`
// happens in a BEGIN IMMEDIATE transaction that only one request can win, across connections.
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { addOrganiser, check, fakeClock, fakeGateway, hold, load, makeApp, onSaleEvent, ROOT, tempDir } from './lib.mjs';

const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
check(readme.includes('A buyer is never charged twice for one hold'), 'README makes the claim');

// Two "servers": separate database connections to one file, sharing the provider.
const dbPath = join(tempDir(), 'shared.db');
const gateway = fakeGateway({ delayMs: 30 });
const clock = fakeClock();
const a = await makeApp({ dbPath, gateway, clock });
const b = await makeApp({ dbPath, gateway, clock, migrate: false });
const { key } = await addOrganiser(a.ctx, 'harbour-hall');
const { eventId, tierIds } = await onSaleEvent(a.call, key);

for (let round = 0; round < 5; round += 1) {
  const token = await hold(a.call, eventId, tierIds[0], { quantity: 1, email: `r${round}@example.test` });
  const before = gateway.charges.length;
  const results = await Promise.all([
    a.call('POST', `/holds/${token}/checkout`, { body: { paymentToken: 'tok_visa' } }),
    b.call('POST', `/holds/${token}/checkout`, { body: { paymentToken: 'tok_visa' } }),
    a.call('POST', `/holds/${token}/checkout`, { body: { paymentToken: 'tok_visa' } }),
  ]);
  const statuses = results.map((res) => res.status).sort();
  check(gateway.charges.length === before + 1, `round ${round}: one charge for three concurrent submits (${statuses})`);
  const late = await b.call('POST', `/holds/${token}/checkout`, { body: { paymentToken: 'tok_visa' } });
  check(late.status === 201 && late.json.order.status === 'paid', `round ${round}: a later submit returns the paid order`);
  check(gateway.charges.length === before + 1, `round ${round}: and charges nothing`);
}

// A declined attempt followed by a successful one is one charge too.
const declining = fakeGateway();
const real = declining.charge;
let declined = false;
declining.charge = async (request) => {
  if (!declined) {
    declined = true;
    const { PaymentDeclinedError } = await load('src/payments/gateway.js');
    throw new PaymentDeclinedError('card_declined');
  }
  return real(request);
};
const c = await makeApp({ gateway: declining });
const org = await addOrganiser(c.ctx, 'mill-studio');
const ev = await onSaleEvent(c.call, org.key);
const token = await hold(c.call, ev.eventId, ev.tierIds[0], { quantity: 1 });
const first = await c.call('POST', `/holds/${token}/checkout`, { body: { paymentToken: 'tok_a' } });
const second = await c.call('POST', `/holds/${token}/checkout`, { body: { paymentToken: 'tok_b' } });
check(first.status === 402 && second.status === 201 && declining.charges.length === 1, 'decline then success charges once');
