const toPayment = (row) =>
  row && {
    id: row.id,
    orderId: row.order_id,
    provider: row.provider,
    chargeId: row.charge_id,
    amountCents: row.amount_cents,
    createdAt: row.created_at,
  };

export const paymentRepo = (db) => ({
  record: ({ orderId, provider, chargeId, amountCents, createdAt }) => {
    db.prepare("INSERT INTO payments (order_id, provider, charge_id, amount_cents, created_at) VALUES (?, ?, ?, ?, ?)").run(
      orderId,
      provider,
      chargeId,
      amountCents,
      createdAt,
    );
  },

  findForOrder: (orderId) =>
    toPayment(db.prepare("SELECT * FROM payments WHERE order_id = ? ORDER BY id LIMIT 1").get(orderId)),

  // Takings per UTC day between two ISO timestamps, end exclusive.
  dailyTotals: ({ start, end }) => {
    const rows = db
      .prepare(
        `SELECT day, SUM(paid) AS paid_cents, SUM(refunded) AS refunded_cents FROM (
           SELECT substr(created_at, 1, 10) AS day, amount_cents AS paid, 0 AS refunded
           FROM payments WHERE created_at >= ? AND created_at < ?
           UNION ALL
           SELECT substr(created_at, 1, 10) AS day, 0 AS paid, amount_cents AS refunded
           FROM refunds WHERE created_at >= ? AND created_at < ?
         )
         GROUP BY day ORDER BY day`,
      )
      .all(start, end, start, end);
    return rows.map((row) => ({
      day: row.day,
      paidCents: row.paid_cents,
      refundedCents: row.refunded_cents,
      netCents: row.paid_cents - row.refunded_cents,
    }));
  },
});

export const refundRepo = (db) => ({
  record: ({ orderId, amountCents, providerRefundId, createdAt }) => {
    db.prepare("INSERT INTO refunds (order_id, amount_cents, provider_refund_id, created_at) VALUES (?, ?, ?, ?)").run(
      orderId,
      amountCents,
      providerRefundId,
      createdAt,
    );
  },

  totalFor: (orderId) =>
    db.prepare("SELECT COALESCE(SUM(amount_cents), 0) AS total FROM refunds WHERE order_id = ?").get(orderId).total,

  listFor: (orderId) =>
    db
      .prepare("SELECT amount_cents, provider_refund_id, created_at FROM refunds WHERE order_id = ? ORDER BY id")
      .all(orderId)
      .map((row) => ({ amountCents: row.amount_cents, providerRefundId: row.provider_refund_id, createdAt: row.created_at })),
});
