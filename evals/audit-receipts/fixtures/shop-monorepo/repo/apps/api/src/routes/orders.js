import { ConflictError, NotFoundError, canTransition, cancelOrder } from "../../../../packages/core/src/index.js";
import { customerOrder } from "../serialize.js";

const USER = { auth: "user" };

export const orderRoutes = (router, { store, payments }) => {
  const ownOrder = (user, number) => {
    const order = store.orders.findByNumber(number);
    if (!order || order.userId !== user.id) {
      throw new NotFoundError("order");
    }
    return order;
  };

  router.get("/api/orders", ({ user }) => ({ body: { items: store.orders.listForUser(user.id) } }), USER);

  router.get("/api/orders/:number", ({ user, params }) => ({ body: { order: customerOrder(ownOrder(user, params.number)) } }), USER);

  // Only unpaid orders can be cancelled by the shopper. The intent is cancelled first, so a
  // payment that lands in the meantime makes this fail instead of leaving a paid, cancelled order.
  router.post(
    "/api/orders/:number/cancel",
    async ({ user, params, now }) => {
      const order = ownOrder(user, params.number);
      if (!canTransition(order.status, "cancelled")) {
        throw new ConflictError(`Order ${order.number} can't be cancelled now`, "invalid_status");
      }
      if (order.paymentIntentId) {
        await payments.cancelIntent(order.paymentIntentId);
      }
      const cancelled = cancelOrder(store, { userId: user.id, number: order.number, now });
      return { body: { order: customerOrder(cancelled) } };
    },
    USER,
  );
};
