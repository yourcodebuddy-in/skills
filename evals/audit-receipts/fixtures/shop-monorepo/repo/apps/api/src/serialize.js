// What each audience sees of a record. Anything not listed here stays on the server.

export const publicUser = (user) => ({ id: user.id, email: user.email, name: user.name, role: user.role });

export const publicProduct = (product) => ({
  id: product.id,
  sku: product.sku,
  name: product.name,
  description: product.description,
  priceCents: product.priceCents,
  inStock: product.stock > 0,
});

export const adminProduct = (product) => ({
  ...publicProduct(product),
  stock: product.stock,
  active: product.active,
  updatedAt: product.updatedAt,
});

const totals = (order) => ({
  subtotalCents: order.subtotalCents,
  discountCents: order.discountCents,
  shippingCents: order.shippingCents,
  taxCents: order.taxCents,
  totalCents: order.totalCents,
});

export const customerOrder = (order) => ({
  number: order.number,
  status: order.status,
  ...totals(order),
  couponCode: order.couponCode,
  shipping: order.shipping,
  note: order.note,
  items: order.items,
  paymentIntentId: order.status === "pending_payment" ? order.paymentIntentId : null,
  createdAt: order.createdAt,
  paidAt: order.paidAt,
  fulfilledAt: order.fulfilledAt,
});

export const adminOrder = (order, { customer, refunds, refundableCents }) => ({
  ...customerOrder(order),
  paymentIntentId: order.paymentIntentId,
  customer: customer ? { id: customer.id, email: customer.email, name: customer.name } : null,
  refunds,
  refundableCents,
  cancelledAt: order.cancelledAt,
  refundedAt: order.refundedAt,
});
