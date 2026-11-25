import { NotFoundError } from "../../../../packages/core/src/index.js";
import { customerOrder } from "../serialize.js";

const USER = { auth: "user" };

// Stand-ins for the provider's hosted payment page. Registered outside production only.
export const devRoutes = (router, { store, payments }) => {
  const ownIntent = (user, intentId) => {
    const order = store.orders.findByPaymentIntent(intentId);
    if (!order || order.userId !== user.id) {
      throw new NotFoundError("payment");
    }
    return order;
  };

  router.post(
    "/api/dev/payments/:intentId/pay",
    async ({ user, params }) => {
      const order = ownIntent(user, params.intentId);
      await payments.simulatePayment(params.intentId);
      return { body: { order: customerOrder(store.orders.findByNumber(order.number)) } };
    },
    USER,
  );

  router.post(
    "/api/dev/payments/:intentId/decline",
    async ({ user, params }) => {
      const order = ownIntent(user, params.intentId);
      await payments.simulateDecline(params.intentId);
      return { body: { order: customerOrder(store.orders.findByNumber(order.number)) } };
    },
    USER,
  );
};
