// Applied in order, once each. Never edit a migration that has shipped; add a new one.

export const migrations = [
  {
    id: 1,
    name: "users_and_sessions",
    sql: `
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
        created_at TEXT NOT NULL
      );
      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );
      CREATE INDEX sessions_user ON sessions(user_id);
    `,
  },
  {
    id: 2,
    name: "catalogue",
    sql: `
      CREATE TABLE products (
        id INTEGER PRIMARY KEY,
        sku TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
        stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
  },
  {
    id: 3,
    name: "carts",
    sql: `
      CREATE TABLE carts (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL
      );
      CREATE TABLE cart_items (
        cart_id TEXT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id),
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        unit_price_cents INTEGER NOT NULL,
        added_at TEXT NOT NULL,
        PRIMARY KEY (cart_id, product_id)
      );
    `,
  },
  {
    id: 4,
    name: "orders",
    sql: `
      CREATE TABLE orders (
        id INTEGER PRIMARY KEY,
        number TEXT NOT NULL UNIQUE,
        user_id INTEGER NOT NULL REFERENCES users(id),
        status TEXT NOT NULL,
        subtotal_cents INTEGER NOT NULL,
        discount_cents INTEGER NOT NULL DEFAULT 0,
        shipping_cents INTEGER NOT NULL DEFAULT 0,
        tax_cents INTEGER NOT NULL DEFAULT 0,
        total_cents INTEGER NOT NULL,
        coupon_code TEXT,
        ship_name TEXT NOT NULL,
        ship_line1 TEXT NOT NULL,
        ship_line2 TEXT,
        ship_city TEXT NOT NULL,
        ship_postcode TEXT NOT NULL,
        ship_country TEXT NOT NULL,
        payment_intent_id TEXT UNIQUE,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        paid_at TEXT,
        fulfilled_at TEXT,
        cancelled_at TEXT,
        refunded_at TEXT
      );
      CREATE INDEX orders_user ON orders(user_id, created_at);
      CREATE INDEX orders_status ON orders(status, created_at);
      CREATE TABLE order_items (
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id),
        sku TEXT NOT NULL,
        name TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price_cents INTEGER NOT NULL,
        line_total_cents INTEGER NOT NULL,
        PRIMARY KEY (order_id, product_id)
      );
    `,
  },
  {
    id: 5,
    name: "payments_and_refunds",
    sql: `
      CREATE TABLE payments (
        id INTEGER PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id),
        provider TEXT NOT NULL,
        charge_id TEXT NOT NULL,
        amount_cents INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX payments_order ON payments(order_id);
      CREATE INDEX payments_created ON payments(created_at);
      CREATE TABLE refunds (
        id INTEGER PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id),
        amount_cents INTEGER NOT NULL,
        provider_refund_id TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX refunds_order ON refunds(order_id);
    `,
  },
  {
    id: 6,
    name: "coupons",
    sql: `
      CREATE TABLE coupons (
        code TEXT PRIMARY KEY,
        percent_off INTEGER,
        amount_off_cents INTEGER,
        max_redemptions INTEGER,
        redemptions INTEGER NOT NULL DEFAULT 0,
        expires_on TEXT,
        created_at TEXT NOT NULL
      );
    `,
  },
  {
    id: 7,
    name: "outbox",
    sql: `
      CREATE TABLE outbox (
        id INTEGER PRIMARY KEY,
        kind TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        sent_at TEXT
      );
      CREATE INDEX outbox_pending ON outbox(sent_at, id);
    `,
  },
  {
    id: 8,
    name: "order_notes",
    sql: "ALTER TABLE orders ADD COLUMN note TEXT;",
  },
  {
    id: 9,
    name: "coupon_minimum_spend",
    sql: "ALTER TABLE coupons ADD COLUMN min_subtotal_cents INTEGER NOT NULL DEFAULT 0;",
  },
];
