-- Partial refunds: an organiser can refund some of an order's tickets.
ALTER TABLE orders ADD COLUMN refunded_quantity INTEGER NOT NULL DEFAULT 0;

CREATE TABLE refunds (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders (id),
  quantity INTEGER NOT NULL CHECK (quantity >= 0),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  reason TEXT NOT NULL CHECK (reason IN ('organiser', 'event_cancelled', 'provider')),
  provider_ref TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE INDEX refunds_order ON refunds (order_id);
