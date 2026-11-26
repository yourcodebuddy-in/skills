import { authenticate } from '../auth.js';
import { csv, json } from '../http/respond.js';
import { parseId } from '../lib/validate.js';
import { eventCancelledEmail } from '../mail/templates.js';
import {
  addTier,
  cancelEvent,
  createEvent,
  getEventForTenant,
  listEvents,
  listTiers,
  publishEvent,
  serializeEvent,
  updateEvent,
  updateTier,
} from '../services/events.js';
import { refundTickets } from '../services/refunds.js';
import { exportOrdersCsv, listOrders, salesSummary } from '../services/reports.js';

// Organiser routes. Every handler runs with req.tenant set from the API key.
export function registerEventRoutes(router, ctx) {
  const { db, clock } = ctx;
  const organiser = (handler) => async (req) => {
    req.tenant = authenticate(db, req.headers, clock.now());
    return handler(req);
  };
  const eventId = (req) => parseId(req.params.eventId, 'eventId');
  const withTiers = (event) => serializeEvent(event, listTiers(db, event.id));

  router.get(
    '/events',
    organiser((req) => json(200, { events: listEvents(db, req.tenant.id).map(withTiers) })),
  );

  router.post(
    '/events',
    organiser((req) => {
      const id = createEvent(db, req.tenant.id, req.json(), clock.now());
      return json(201, { event: withTiers(getEventForTenant(db, req.tenant.id, id)) });
    }),
  );

  router.get(
    '/events/:eventId',
    organiser((req) => json(200, { event: withTiers(getEventForTenant(db, req.tenant.id, eventId(req))) })),
  );

  router.patch(
    '/events/:eventId',
    organiser((req) => {
      const event = updateEvent(db, req.tenant.id, eventId(req), req.json(), clock.now());
      return json(200, { event: withTiers(event) });
    }),
  );

  router.post(
    '/events/:eventId/publish',
    organiser((req) => json(200, { event: withTiers(publishEvent(db, req.tenant.id, eventId(req), clock.now())) })),
  );

  router.post(
    '/events/:eventId/cancel',
    organiser(async (req) => {
      const { event, buyers } = cancelEvent(db, req.tenant.id, eventId(req), clock.now());
      for (const buyer of buyers) {
        await ctx.mailer.send(eventCancelledEmail({ event, buyer }));
      }
      return json(200, { event: withTiers(event), notified: buyers.length });
    }),
  );

  router.post(
    '/events/:eventId/tiers',
    organiser((req) => {
      const tier = addTier(db, req.tenant.id, eventId(req), req.json());
      return json(201, { tier: serializeEvent({}, [tier]).tiers[0] });
    }),
  );

  router.patch(
    '/events/:eventId/tiers/:tierId',
    organiser((req) => {
      const tier = updateTier(db, req.tenant.id, eventId(req), parseId(req.params.tierId, 'tierId'), req.json());
      return json(200, { tier: serializeEvent({}, [tier]).tiers[0] });
    }),
  );

  router.get(
    '/events/:eventId/orders',
    organiser((req) => json(200, listOrders(db, req.tenant.id, eventId(req), req.query))),
  );

  router.post(
    '/events/:eventId/orders/:orderToken/refunds',
    organiser(async (req) => {
      const refund = await refundTickets(ctx, req.tenant.id, eventId(req), req.params.orderToken, req.json());
      return json(201, { refund });
    }),
  );

  router.get(
    '/events/:eventId/report',
    organiser((req) => json(200, salesSummary(db, req.tenant, eventId(req)))),
  );

  router.get(
    '/events/:eventId/orders.csv',
    organiser((req) => {
      const { filename, body } = exportOrdersCsv(db, eventId(req), { timeZone: req.tenant.timezone });
      return csv(filename, body);
    }),
  );
}
