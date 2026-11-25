import { UNPAID_ORDER_MINUTES, expireOrder } from "../../../packages/core/src/index.js";

// Background jobs for the API process: send queued emails, cancel orders left unpaid, and delete
// expired sessions. A message that fails to send is retried on the next tick, up to the attempt
// limit in the outbox repository.
export const startWorker = ({ store, payments, logger, send, intervalMs, now = () => new Date() }) => {
  let running = false;

  const sendEmails = async () => {
    for (const message of store.outbox.pending()) {
      try {
        await send(message);
        store.outbox.markSent(message.id, now().toISOString());
      } catch (error) {
        store.outbox.markFailed(message.id);
        logger.warn("outbox.send_failed", { id: message.id, kind: message.kind, message: error.message });
      }
    }
  };

  // The intent is cancelled first; if the shopper paid in the meantime the provider refuses, and
  // the order is left for the webhook to mark paid.
  const expireUnpaidOrders = async () => {
    const cutoff = new Date(now().getTime() - UNPAID_ORDER_MINUTES * 60_000).toISOString();
    for (const order of store.orders.listUnpaidBefore(cutoff)) {
      try {
        if (order.paymentIntentId) {
          await payments.cancelIntent(order.paymentIntentId);
        }
        if (expireOrder(store, { number: order.number, now: now() })) {
          logger.info("order.expired", { order: order.number });
        }
      } catch (error) {
        logger.warn("order.expire_failed", { order: order.number, code: error.code, message: error.message });
      }
    }
  };

  const tick = async () => {
    if (running) {
      return;
    }
    running = true;
    try {
      await sendEmails();
      await expireUnpaidOrders();
      store.sessions.deleteExpired(now().toISOString());
    } finally {
      running = false;
    }
  };

  const timer = setInterval(tick, intervalMs);
  timer.unref();
  return { tick, stop: () => clearInterval(timer) };
};

// Until a mail provider is chosen, emails are written to the log.
export const logMailer = (logger) => async (message) => {
  logger.info("mail.sent", { kind: message.kind, order: message.payload.orderNumber, userId: message.payload.userId });
};
