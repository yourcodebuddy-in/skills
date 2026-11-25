CREATE TABLE outbox (
    id INTEGER PRIMARY KEY,
    clinic_id INTEGER NOT NULL REFERENCES clinics (id),
    booking_id INTEGER REFERENCES bookings (id),
    kind TEXT NOT NULL,
    recipient TEXT NOT NULL,
    body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    due_at TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    sent_at TEXT,
    last_error TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX outbox_due ON outbox (status, due_at);

ALTER TABLE bookings ADD COLUMN reminder_queued INTEGER NOT NULL DEFAULT 0;
