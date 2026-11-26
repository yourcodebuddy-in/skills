// The README says HOLD_MINUTES defaults to 10; the code defaults to 15.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { addOrganiser, check, load, makeApp, onSaleEvent, ROOT } from './lib.mjs';

const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
check(/\| `HOLD_MINUTES` \| `10` \|/.test(readme), 'README documents a default of 10 minutes');

const { loadConfig } = await load('src/config.js');
check(loadConfig({}).holdMinutes === 15, 'loadConfig with no HOLD_MINUTES gives 15');

const { ctx, call } = await makeApp();
const { key } = await addOrganiser(ctx, 'harbour-hall');
const { eventId, tierIds } = await onSaleEvent(call, key);
const res = await call('POST', `/public/events/${eventId}/holds`, {
  body: { tierId: tierIds[0], quantity: 1, email: 'x@example.test', name: 'X' },
});
check(res.json.hold.expiresAt === '2026-05-01T10:15:00.000Z', 'a hold made at 10:00 expires at 10:15');
