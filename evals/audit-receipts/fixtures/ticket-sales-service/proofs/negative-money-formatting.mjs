// formatMoney breaks for negative amounts that aren't whole units. The sales report shows refunds
// as a negative amount, so any refund with cents prints a garbled figure.
import { addOrganiser, buy, check, load, makeApp, onSaleEvent } from './lib.mjs';

const { formatMoney } = await load('src/lib/money.js');
check(formatMoney(-1205) !== '€-12.05', `formatMoney(-1205) is "${formatMoney(-1205)}", not "€-12.05"`);

const { ctx, call } = await makeApp();
const { key } = await addOrganiser(ctx, 'harbour-hall');
const { eventId, tierIds } = await onSaleEvent(call, key, [{ name: 'Seated', priceCents: 1250, capacity: 50 }]);
const order = await buy(call, eventId, tierIds[0], { quantity: 2 });
await call('POST', `/events/${eventId}/orders/${order.token}/refunds`, { key, body: { quantity: 1 } });

const report = (await call('GET', `/events/${eventId}/report`, { key })).json;
check(report.refundedCents === 1250, 'the report knows 12.50 was refunded');
check(report.display.refunded === '€-13.-50', `but shows it as "${report.display.refunded}"`);
