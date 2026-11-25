CREATE TABLE fee_jobs (
    id INTEGER PRIMARY KEY,
    clinic_id INTEGER NOT NULL REFERENCES clinics (id),
    booking_id INTEGER NOT NULL REFERENCES bookings (id),
    patient_id INTEGER NOT NULL REFERENCES patients (id),
    card_ref TEXT NOT NULL,
    reason TEXT NOT NULL CHECK (reason IN ('late_cancel', 'no_show')),
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    currency TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'charged', 'declined')),
    gateway_ref TEXT,
    created_at TEXT NOT NULL,
    charged_at TEXT,
    UNIQUE (booking_id, reason)
);

CREATE INDEX fee_jobs_status ON fee_jobs (status, id);
