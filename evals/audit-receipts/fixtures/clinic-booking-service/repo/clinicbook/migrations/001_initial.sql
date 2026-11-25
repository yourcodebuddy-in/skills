CREATE TABLE clinics (
    id INTEGER PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    timezone TEXT NOT NULL,
    currency TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE patients (
    id INTEGER PRIMARY KEY,
    clinic_id INTEGER NOT NULL REFERENCES clinics (id),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    card_ref TEXT,
    created_at TEXT NOT NULL,
    UNIQUE (clinic_id, email)
);

CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    clinic_id INTEGER NOT NULL REFERENCES clinics (id),
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'staff', 'patient')),
    patient_id INTEGER REFERENCES patients (id),
    created_at TEXT NOT NULL,
    CHECK ((role = 'patient') = (patient_id IS NOT NULL))
);

CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users (id),
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
);

CREATE INDEX sessions_expires ON sessions (expires_at);

CREATE TABLE login_attempts (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL,
    succeeded INTEGER NOT NULL,
    attempted_at TEXT NOT NULL
);

CREATE INDEX login_attempts_time ON login_attempts (attempted_at);

CREATE TABLE practitioners (
    id INTEGER PRIMARY KEY,
    clinic_id INTEGER NOT NULL REFERENCES clinics (id),
    name TEXT NOT NULL,
    specialty TEXT NOT NULL DEFAULT '',
    slot_minutes INTEGER NOT NULL CHECK (slot_minutes BETWEEN 10 AND 120),
    price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
    active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE working_hours (
    id INTEGER PRIMARY KEY,
    practitioner_id INTEGER NOT NULL REFERENCES practitioners (id),
    weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL
);

CREATE INDEX working_hours_practitioner ON working_hours (practitioner_id, weekday);

CREATE TABLE bookings (
    id INTEGER PRIMARY KEY,
    clinic_id INTEGER NOT NULL REFERENCES clinics (id),
    practitioner_id INTEGER NOT NULL REFERENCES practitioners (id),
    patient_id INTEGER NOT NULL REFERENCES patients (id),
    start_utc TEXT NOT NULL,
    end_utc TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('booked', 'cancelled', 'completed', 'no_show')),
    price_cents INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    cancelled_at TEXT
);

CREATE INDEX bookings_practitioner_start ON bookings (practitioner_id, start_utc);
CREATE INDEX bookings_clinic_start ON bookings (clinic_id, start_utc);
CREATE INDEX bookings_patient ON bookings (patient_id, status);
