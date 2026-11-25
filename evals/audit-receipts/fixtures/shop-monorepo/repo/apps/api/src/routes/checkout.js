import {
  DOMESTIC_COUNTRY,
  cancelOrder,
  parseCountry,
  parseCouponCode,
  parseNote,
  parseShipping,
  placeOrder,
  priceCheckout,
} from "../../../../packages/core/src/index.js";
import { HttpError } from "../http.js";
import { customerOrder } from "../serialize.js";

const USER = { auth: "user" };

export const checkoutRoutes = (router, { store, payments, logger }) => {
  router.post(
    "/api/checkout/quote",
    ({ user, body, now }) => {
      const country = body.country === undefined ? DOMESTIC_COUNTRY : parseCountry(body.country);
      const couponCode = parseCouponCode(body.couponCode);
      return { body: { quote: priceCheckout(store, { userId: user.id, couponCode, country, now }) } };
    },
    USER,
  );

  router.post(
    "/api/checkout",
    async ({ user, body, now }) => {
      const order = placeOrder(store, {
        userId: user.id,
        shipping: parseShipping(body.shipping),
        couponCode: parseCouponCode(body.couponCode),
        note: parseNote(body.note),
        now,
      });

      let intent;
      try {
        intent = await payments.createIntent({ amountCents: order.totalCents, reference: order.number });
      } catch (error) {
        cancelOrder(store, { userId: user.id, number: order.number, now });
        logger.error("checkout.intent_failed", { order: order.number, code: error.code, message: error.message });
        throw new HttpError(502, "payment_unavailable", "We couldn't start the payment, so the order was cancelled. Please try again.");
      }

      store.orders.setPaymentIntent(order.id, intent.id);
      const placed = store.orders.findByNumber(order.number);
      logger.info("checkout.placed", { order: placed.number, totalCents: placed.totalCents });
      return {
        status: 201,
        body: { order: customerOrder(placed), payment: { provider: payments.name, intentId: intent.id } },
      };
    },
    USER,
  );
};
