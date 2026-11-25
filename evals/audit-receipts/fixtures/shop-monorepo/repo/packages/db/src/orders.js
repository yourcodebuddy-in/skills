// The timestamp column each status sets when an order moves into it.
const STATUS_TIMESTAMPS = Object.freeze({
  paid: "paid_at",
  fulfilled: "fulfilled_at",
  cancelled: "cancelled_at",
  refunded: "refunded_at",
});

const toItem = (row) => ({
  productId: row.product_id,
  sku: row.sku,
  name: row.name,
  quantity: row.quantity,
  unitPriceCents: row.unit_price_cents,
  lineTotalCents: row.line_total_cents,
});

const toOrder = (row) =>
  row && {
    id: row.id,
    number: row.number,
    userId: row.user_id,
    status: row.status,
    subtotalCents: row.subtotal_cents,
    discountCents: row.discount_cents,
    shippingCents: row.shipping_cents,
    taxCents: row.tax_cents,
    totalCents: row.total_cents,
    couponCode: row.coupon_code,
    note: row.note,
    shipping: {
      name: row.ship_name,
      line1: row.ship_line1,
      line2: row.ship_line2,
      city: row.ship_city,
      postcode: row.ship_postcode,
      country: row.ship_country,
    },
    paymentIntentId: row.payment_intent_id,
    createdAt: row.created_at,
    paidAt: row.paid_at,
    fulfilledAt: row.fulfilled_at,
    cancelledAt: row.cancelled_at,
    refundedAt: row.refunded_at,
  };

const toListedOrder = (row) => ({
  number: row.number,
  status: row.status,
  totalCents: row.total_cents,
  createdAt: row.created_at,
  customerEmail: row.email,
  itemCount: row.item_count,
});

export const orderRepo = (db) => {
  const byNumber = db.prepare("SELECT * FROM orders WHERE number = ?");
  const byIntent = db.prepare("SELECT * FROM orders WHERE payment_intent_id = ?");
  const items = db.prepare("SELECT * FROM order_items WHERE order_id = ? ORDER BY rowid");

  const withItems = (row) => {
    const order = toOrder(row);
    return order && { ...order, items: items.all(order.id).map(toItem) };
  };

  return {
    create: (order) => {
      const { shipping } = order;
      const result = db
        .prepare(
          `INSERT INTO orders (
             number, user_id, status, subtotal_cents, discount_cents, shipping_cents, tax_cents, total_cents,
             coupon_code, note, ship_name, ship_line1, ship_line2, ship_city, ship_postcode, ship_country,
             created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          order.number,
          order.userId,
          order.status,
          order.subtotalCents,
          order.discountCents,
          order.shippingCents,
          order.taxCents,
          order.totalCents,
          order.couponCode,
          order.note,
          shipping.name,
          shipping.line1,
          shipping.line2,
          shipping.city,
          shipping.postcode,
          shipping.country,
          order.createdAt,
          order.createdAt,
        );
      return { id: Number(result.lastInsertRowid), number: order.number };
    },

    addItem: (orderId, item) => {
      db.prepare(
        `INSERT INTO order_items (order_id, product_id, sku, name, quantity, unit_price_cents, line_total_cents)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(orderId, item.productId, item.sku, item.name, item.quantity, item.unitPriceCents, item.lineTotalCents);
    },

    findByNumber: (number) => withItems(byNumber.get(number)),

    findByPaymentIntent: (intentId) => withItems(byIntent.get(intentId)),

    setPaymentIntent: (orderId, intentId) => {
      db.prepare("UPDATE orders SET payment_intent_id = ? WHERE id = ?").run(intentId, orderId);
    },

    setStatus: (orderId, status, at) => {
      const column = STATUS_TIMESTAMPS[status];
      const stamp = column ? `, ${column} = ?` : "";
      const params = column ? [status, at, at, orderId] : [status, at, orderId];
      db.prepare(`UPDATE orders SET status = ?, updated_at = ?${stamp} WHERE id = ?`).run(...params);
    },

    listUnpaidBefore: (createdBefore) =>
      db
        .prepare("SELECT number, payment_intent_id FROM orders WHERE status = 'pending_payment' AND created_at < ? ORDER BY id")
        .all(createdBefore)
        .map((row) => ({ number: row.number, paymentIntentId: row.payment_intent_id })),

    listForUser: (userId) =>
      db
        .prepare(
          `SELECT orders.number, orders.status, orders.total_cents, orders.created_at, users.email,
                  (SELECT SUM(quantity) FROM order_items WHERE order_id = orders.id) AS item_count
           FROM orders JOIN users ON users.id = orders.user_id
           WHERE orders.user_id = ?
           ORDER BY orders.created_at DESC, orders.id DESC`,
        )
        .all(userId)
        .map(toListedOrder),

    list: ({ status = null, limit, offset }) => {
      const where = status ? "WHERE orders.status = ?" : "";
      const params = status ? [status] : [];
      const rows = db
        .prepare(
          `SELECT orders.number, orders.status, orders.total_cents, orders.created_at, users.email,
                  (SELECT SUM(quantity) FROM order_items WHERE order_id = orders.id) AS item_count
           FROM orders JOIN users ON users.id = orders.user_id
           ${where}
           ORDER BY orders.created_at DESC, orders.id DESC
           LIMIT ? OFFSET ?`,
        )
        .all(...params, limit, offset);
      const { total } = db.prepare(`SELECT COUNT(*) AS total FROM orders ${where}`).get(...params);
      return { items: rows.map(toListedOrder), total };
    },
  };
};
