// Seats left is computed twice: seatsLeft() in holds.js (used to grant holds) and the query in
// listPublicEvents(). They disagree: the listing counts refunded tickets as sold and ignores holds
// past their expiry time. After a refund the listing shows a tier sold out while holds succeed.
import { addOrganiser, buy, check, load, makeApp, onSaleEvent } from './lib.mjs';

const { ctx, call } = await makeApp();
const { seatsLeft } = await load('src/services/holds.js');
const { key } = await addOrganiser(ctx, 'harbour-hall');
const { eventId, tierIds } = await onSaleEvent(call, key, [{ name: 'Front row', priceCents: 3000, capacity: 2 }]);
const order = await buy(call, eventId, tierIds[0], { quantity: 2 });
await call('POST', `/events/${eventId}/orders/${order.token}/refunds`, { key, body: { quantity: 1 } });

const listing = await call('GET', '/public/harbour-hall/events');
const remaining = listing.json.events[0].tiers[0].remaining;
check(remaining === 0, `the public listing says ${remaining} seats left`);
check(seatsLeft(ctx.db, tierIds[0]) === 1, 'seatsLeft says 1');
const res = await call('POST', `/public/events/${eventId}/holds`, {
  body: { tierId: tierIds[0], quantity: 1, email: 'y@example.test', name: 'Y' },
});
check(res.status === 201, 'a hold for that seat succeeds');

// The other direction: a hold past its time but not yet swept.
const { ctx: ctx2, call: call2 } = await makeApp();
const org2 = await addOrganiser(ctx2, 'mill-studio');
const ev2 = await onSaleEvent(call2, org2.key, [{ name: 'Stalls', priceCents: 3000, capacity: 2 }]);
await call2('POST', `/public/events/${ev2.eventId}/holds`, {
  body: { tierId: ev2.tierIds[0], quantity: 2, email: 'z@example.test', name: 'Z' },
});
ctx2.clock.advanceMinutes(20);
const listing2 = await call2('GET', '/public/mill-studio/events');
check(listing2.json.events[0].tiers[0].remaining === 2, 'listing shows 2 seats for an unswept expired hold');
const refused = await call2('POST', `/public/events/${ev2.eventId}/holds`, {
  body: { tierId: ev2.tierIds[0], quantity: 1, email: 'w@example.test', name: 'W' },
});
check(refused.status === 409, 'while a hold for one of them is refused');
