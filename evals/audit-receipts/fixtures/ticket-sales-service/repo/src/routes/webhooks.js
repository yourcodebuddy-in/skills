import { HttpError } from '../http/errors.js';
import { json } from '../http/respond.js';
import { parseEvent, verifySignature } from '../payments/webhook.js';
import { applyProviderRefund } from '../services/refunds.js';

export function registerWebhookRoutes(router, ctx) {
  const { db, config, clock, log } = ctx;

  router.post('/webhooks/payments', (req) => {
    if (!verifySignature(req.rawBody, req.headers['x-payments-signature'], config.payments.webhookSecret)) {
      throw new HttpError(401, 'bad_signature');
    }
    const event = parseEvent(req.rawBody);
    if (!event) throw new HttpError(400, 'bad_event');

    if (event.type !== 'charge.refunded') {
      log.debug('webhook.ignored', { type: event.type });
      return json(202, { ignored: true });
    }
    const result = applyProviderRefund(db, event.data, clock.now());
    if (!result) throw new HttpError(404, 'unknown_payment');
    return json(200, result);
  });
}
