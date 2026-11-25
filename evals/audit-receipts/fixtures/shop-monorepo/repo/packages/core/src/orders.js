import { randomBytes } from "node:crypto";
import { checkCoupon } from "./coupons.js";
import { ConflictError, CouponError, NotFoundError, OutOfStockError } from "./errors.js";
import { lineTotal, quote } from "./pricing.js";

const TRANSITIONS = Object.freeze({
  pending_payment: ["paid", "cancelled"],
  paid: ["fulfilled", "refunded"],
  fulfilled: ["refunded"],
  cancelled: [],
  refunded: [],
});

export const canTransition = (from, to) => TRANSITIONS[from]?.includes(to) ?? false;

const assertTransition = (order, to) => {
  if (!canTransition(order.status, to)) {
    throw new ConflictError(`Order ${order.number} is ${order.status.replace("_", " ")}`, "invalid_status");
  }
};

// 32 symbols, no I, O, 0 or 1, so a number read out over the phone isn't misheard.
const NUMBER_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const newOrderNumber = () => {
  let number = "SO-";
  for (const byte of randomBytes(8)) {
    number += NUMBER_ALPHABET[byte % NUMBER_ALPHABET.length];
  }
  return number;
};

const loadCart = (store, userId) => {
  const cart = store.carts.findForUser(userId);
  const lines = cart ? store.carts.lines(cart.id) : [];
  if (lines.length === 0) {
    throw new ConflictError("Your cart is empty", "cart_empty");
  }
  return { cart, lines };
};

const couponFor = (store, { couponCode, lines, now }) => {
  if (!couponCode) {
    return null;
  }
  const { subtotalCents } = quote({ lines });
  return checkCoupon(store.coupons.find(couponCode), { now, subtotalCents });
};

export const priceCheckout = (store, { userId, couponCode, country, now }) => {
  const { lines } = loadCart(store, userId);
  const coupon = couponFor(store, { couponCode, lines, now });
  return { ...quote({ lines, coupon, country }), couponCode: coupon?.code ?? null };
};

export const placeOrder = (store, { userId, shipping, couponCode, note, now }) =>
  store.transaction(() => {
    const { cart, lines } = loadCart(store, userId);
    const coupon = couponFor(store, { couponCode, lines, now });
    const totals = quote({ lines, coupon, country: shipping.country });

    for (const line of lines) {
      if (!store.products.takeStock(line.productId, line.quantity)) {
        throw new OutOfStockError(line.productId);
      }
    }
    if (coupon && !store.coupons.redeem(coupon.code)) {
      throw new CouponError("That code has been used up", "coupon_used_up");
    }

    const order = store.orders.create({
      number: newOrderNumber(),
      userId,
      status: "pending_payment",
      ...totals,
      couponCode: coupon?.code ?? null,
      shipping,
      note,
      createdAt: now.toISOString(),
    });
    for (const line of lines) {
      store.orders.addItem(order.id, {
        productId: line.productId,
        sku: line.sku,
        name: line.name,
        quantity: line.quantity,
        unitPriceCents: line.unitPriceCents,
        lineTotalCents: lineTotal(line),
      });
    }
    store.carts.clear(cart.id);
    return store.orders.findByNumber(order.number);
  });

export const markOrderPaid = (store, { paymentIntentId, provider, chargeId, amountCents, paidAt }) =>
  store.transaction(() => {
    const order = store.orders.findByPaymentIntent(paymentIntentId);
    if (!order) {
      throw new NotFoundError("order");
    }
    if (order.status === "cancelled") {
      throw new ConflictError(`Order ${order.number} was cancelled before payment`, "order_cancelled");
    }
    if (amountCents !== order.totalCents) {
      throw new ConflictError("Payment amount doesn't match the order", "amount_mismatch");
    }
    const at = paidAt.toISOString();
    store.orders.setStatus(order.id, "paid", at);
    store.payments.record({ orderId: order.id, provider, chargeId, amountCents, createdAt: at });
    store.outbox.enqueue("order_confirmation", { orderNumber: order.number, userId: order.userId }, at);
    return store.orders.findByNumber(order.number);
  });

const releaseOrder = (store, order, at) => {
  for (const item of order.items) {
    store.products.restoreStock(item.productId, item.quantity);
  }
  if (order.couponCode) {
    store.coupons.release(order.couponCode);
  }
  store.orders.setStatus(order.id, "cancelled", at);
};

export const cancelOrder = (store, { userId, number, now }) =>
  store.transaction(() => {
    const order = store.orders.findByNumber(number);
    if (!order || order.userId !== userId) {
      throw new NotFoundError("order");
    }
    assertTransition(order, "cancelled");
    releaseOrder(store, order, now.toISOString());
    return store.orders.findByNumber(number);
  });

// Gives back the stock and coupon use held by an order nobody paid for. Returns false if it got paid meanwhile.
export const expireOrder = (store, { number, now }) =>
  store.transaction(() => {
    const order = store.orders.findByNumber(number);
    if (!order || order.status !== "pending_payment") {
      return false;
    }
    releaseOrder(store, order, now.toISOString());
    return true;
  });

export const fulfilOrder = (store, { number, now }) =>
  store.transaction(() => {
    const order = store.orders.findByNumber(number);
    if (!order) {
      throw new NotFoundError("order");
    }
    assertTransition(order, "fulfilled");
    const at = now.toISOString();
    store.orders.setStatus(order.id, "fulfilled", at);
    store.outbox.enqueue("order_shipped", { orderNumber: order.number, userId: order.userId }, at);
    return store.orders.findByNumber(number);
  });

export const refundableCents = (store, order) => order.totalCents - store.refunds.totalFor(order.id);

export const checkRefund = (store, { number, amountCents }) => {
  const order = store.orders.findByNumber(number);
  if (!order) {
    throw new NotFoundError("order");
  }
  if (!canTransition(order.status, "refunded")) {
    throw new ConflictError(`Order ${order.number} can't be refunded while ${order.status.replace("_", " ")}`, "invalid_status");
  }
  if (amountCents < 1 || amountCents > refundableCents(store, order)) {
    throw new ConflictError("Refund is larger than what's left to refund", "refund_too_large");
  }
  return order;
};

export const recordRefund = (store, { order, amountCents, providerRefundId, now }) =>
  store.transaction(() => {
    const at = now.toISOString();
    store.refunds.record({ orderId: order.id, amountCents, providerRefundId, createdAt: at });
    if (refundableCents(store, order) === 0) {
      assertTransition(order, "refunded");
      store.orders.setStatus(order.id, "refunded", at);
    }
    return store.orders.findByNumber(order.number);
  });
