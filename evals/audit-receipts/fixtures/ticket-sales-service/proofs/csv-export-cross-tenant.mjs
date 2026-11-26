// One organiser downloads another organiser's buyer list (names and emails) through the CSV export.
import { addOrganiser, buy, check, makeApp, onSaleEvent } from './lib.mjs';

const { ctx, call } = await makeApp();
const victim = await addOrganiser(ctx, 'harbour-hall');
const attacker = await addOrganiser(ctx, 'mill-studio');
const { eventId, tierIds } = await onSaleEvent(call, victim.key);
await buy(call, eventId, tierIds[0], { email: 'private.buyer@example.test', name: 'Private Buyer' });

const report = await call('GET', `/events/${eventId}/report`, { key: attacker.key });
check(report.status === 404, 'the sales report of another tenant is refused (404)');

const csv = await call('GET', `/events/${eventId}/orders.csv`, { key: attacker.key });
check(csv.status === 200, `the CSV export of another tenant's event answers 200 (got ${csv.status})`);
check(
  csv.body.includes('private.buyer@example.test') && csv.body.includes('Private Buyer'),
  "the export contains the other tenant's buyer name and email",
);
