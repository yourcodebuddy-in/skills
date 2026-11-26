-- Tenants are the organisers who sell through the service. Every event belongs to one.
CREATE TABLE tenants (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TEXT NOT NULL
);

CREATE TABLE api_keys (
  id INTEGER PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants (id),
  prefix TEXT NOT NULL UNIQUE,
  secret_hash TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  last_used_at TEXT,
  revoked_at TEXT
);

CREATE TABLE events (
  id INTEGER PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants (id),
  title TEXT NOT NULL,
  venue TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'on_sale', 'cancelled')),
  cancelled_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX events_tenant_starts ON events (tenant_id, starts_at);

CREATE TABLE tiers (
  id INTEGER PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events (id),
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  capacity INTEGER NOT NULL CHECK (capacity >= 0),
  position INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX tiers_event ON tiers (event_id, position);

CREATE TABLE holds (
  id INTEGER PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  event_id INTEGER NOT NULL REFERENCES events (id),
  tier_id INTEGER NOT NULL REFERENCES tiers (id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_cents INTEGER NOT NULL,
  buyer_email TEXT NOT NULL,
  buyer_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'converted', 'expired', 'released')),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX holds_tier_status ON holds (tier_id, status);
CREATE INDEX holds_status_expires ON holds (status, expires_at);

CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  hold_id INTEGER NOT NULL UNIQUE REFERENCES holds (id),
  event_id INTEGER NOT NULL REFERENCES events (id),
  tier_id INTEGER NOT NULL REFERENCES tiers (id),
  quantity INTEGER NOT NULL,
  subtotal_cents INTEGER NOT NULL,
  fee_cents INTEGER NOT NULL,
  total_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  buyer_email TEXT NOT NULL,
  buyer_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'charging', 'paid', 'failed', 'refunded')),
  payment_attempt INTEGER NOT NULL DEFAULT 0,
  payment_id TEXT UNIQUE,
  created_at TEXT NOT NULL,
  paid_at TEXT
);

CREATE INDEX orders_event_status ON orders (event_id, status);
CREATE INDEX orders_tier_status ON orders (tier_id, status);

CREATE TABLE tickets (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders (id),
  code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'void')),
  created_at TEXT NOT NULL
);

CREATE INDEX tickets_order ON tickets (order_id);

CREATE TABLE outbox (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  text_body TEXT NOT NULL,
  html_body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL,
  sent_at TEXT
);

CREATE INDEX outbox_status ON outbox (status, id);

CREATE TABLE jobs (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'done', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  run_after TEXT NOT NULL,
  last_error TEXT,
  created_at TEXT NOT NULL,
  finished_at TEXT
);

CREATE INDEX jobs_due ON jobs (status, run_after);
