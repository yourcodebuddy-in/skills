// ADR 0003: every email goes through the outbox and request handlers never call the mail transport.
// The cancel route sends one email per buyer from inside the request. If the transport fails, the
// request errors after the cancellation has committed, and the remaining buyers are never told.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { addOrganiser, buy, check, makeApp, onSaleEvent, ROOT } from './lib.mjs';

const adr = readFileSync(join(ROOT, 'docs/adr/0003-email-through-an-outbox.md'), 'utf8');
check(adr.includes('Request handlers never call the mail transport.'), 'ADR 0003 forbids sending from request handlers');

const mailer = {
  calls: 0,
  async send() {
    mailer.calls += 1;
    if (mailer.calls === 2) throw new Error('mail provider timed out');
  },
};
const { ctx, call } = await makeApp({ mailer });
const { key } = await addOrganiser(ctx, 'harbour-hall');
const { eventId, tierIds } = await onSaleEvent(call, key);
for (const email of ['a@example.test', 'b@example.test', 'c@example.test']) {
  await buy(call, eventId, tierIds[0], { quantity: 1, email });
}
const queuedBefore = ctx.db.prepare('SELECT COUNT(*) AS n FROM outbox').get().n;

const res = await call('POST', `/events/${eventId}/cancel`, { key });
check(mailer.calls === 2, 'the request handler itself called the mail transport');
check(res.status === 500, `the request failed (${res.status}) when the second send failed`);
const event = ctx.db.prepare('SELECT status FROM events WHERE id = ?').get(eventId);
check(event.status === 'cancelled', 'but the event is already cancelled');
check(
  ctx.db.prepare('SELECT COUNT(*) AS n FROM outbox').get().n === queuedBefore,
  'no cancellation notice was put in the outbox, so nothing will retry them',
);
const again = await call('POST', `/events/${eventId}/cancel`, { key });
check(again.status === 409, 'cancelling again is refused, so the third buyer is never told');
