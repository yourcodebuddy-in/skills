const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const day = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric" });

export const formatPrice = (cents) => money.format(cents / 100);

export const formatDate = (iso) => (iso ? day.format(new Date(iso)) : "");

const STATUS_LABELS = Object.freeze({
  pending_payment: "Awaiting payment",
  paid: "Paid",
  fulfilled: "Shipped",
  cancelled: "Cancelled",
  refunded: "Refunded",
});

export const statusLabel = (status) => (Object.hasOwn(STATUS_LABELS, status) ? STATUS_LABELS[status] : status);
