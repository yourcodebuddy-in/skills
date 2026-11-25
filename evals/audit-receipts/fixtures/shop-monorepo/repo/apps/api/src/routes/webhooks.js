import { markOrderPaid } from "../../../../packages/core/src/index.js";
import { SIGNATURE_HEADER, WebhookError, verifyWebhook } from "../../../../packages/payments/src/index.js";
import { HttpError } from "../http.js";

// The provider retries any delivery that doesn't get a 2xx, so only answer 2xx once the event is handled.
export const webhookRoutes = (router, { store, payments, config, logger }) => {
  router.post("/api/webhooks/payments", ({ headers, rawBody }) => {
    let event;
    try {
      event = verifyWebhook({ secret: config.webhookSecret, header: headers[SIGNATURE_HEADER], body: rawBody });
    } catch (error) {
      if (error instanceof WebhookError) {
        logger.warn("webhook.rejected", { reason: error.message });
        throw new HttpError(400, "invalid_signature", error.message);
      }
      throw error;
    }

    switch (event.type) {
      case "payment.succeeded": {
        const order = markOrderPaid(store, {
          paymentIntentId: event.data.intent_id,
          provider: payments.name,
          chargeId: event.data.charge_id,
          amountCents: event.data.amount,
          paidAt: new Date(event.created * 1000),
        });
        logger.info("order.paid", { order: order.number, event: event.id });
        break;
      }
      case "payment.failed":
        logger.info("payment.failed", { intent: event.data.intent_id, reason: event.data.reason, event: event.id });
        break;
      default:
        logger.debug("webhook.ignored", { type: event.type, event: event.id });
    }
    return { body: { received: true } };
  });
};
