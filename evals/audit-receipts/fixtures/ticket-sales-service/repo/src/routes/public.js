import { json, noContent } from '../http/respond.js';
import { parseId } from '../lib/validate.js';
import { listPublicEvents } from '../services/events.js';
import { createHold, getHold, releaseHold, serializeHold } from '../services/holds.js';
import { checkout, getOrderByToken, serializeOrder } from '../services/orders.js';

// Buyer routes. Buyers have no accounts: a hold or order is reached through its token (ADR 0004).
export function registerPublicRoutes(router, ctx) {
  const { db, clock } = ctx;

  router.get('/public/:tenantSlug/events', (req) =>
    json(200, listPublicEvents(db, req.params.tenantSlug, clock.now())),
  );

  router.post('/public/events/:eventId/holds', (req) => {
    const hold = createHold(ctx, parseId(req.params.eventId, 'eventId'), req.json());
    return json(201, { hold: serializeHold(hold) });
  });

  router.get('/holds/:holdToken', (req) => json(200, { hold: serializeHold(getHold(db, req.params.holdToken)) }));

  router.delete('/holds/:holdToken', (req) => {
    releaseHold(db, req.params.holdToken);
    return noContent();
  });

  router.post('/holds/:holdToken/checkout', async (req) => {
    const order = await checkout(ctx, req.params.holdToken, req.json());
    const { tickets } = getOrderByToken(db, order.token);
    return json(201, { order: serializeOrder(order, tickets) });
  });

  router.get('/orders/:orderToken', (req) => {
    const { order, tickets } = getOrderByToken(db, req.params.orderToken);
    return json(200, { order: serializeOrder(order, tickets) });
  });
}
