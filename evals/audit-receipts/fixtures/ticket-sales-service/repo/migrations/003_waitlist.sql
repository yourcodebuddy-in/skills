CREATE TABLE waitlist (
  id INTEGER PRIMARY KEY,
  tier_id INTEGER NOT NULL REFERENCES tiers (id),
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  notified_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (tier_id, email)
);
