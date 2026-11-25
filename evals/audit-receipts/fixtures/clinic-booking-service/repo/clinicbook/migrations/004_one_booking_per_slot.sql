DROP INDEX bookings_practitioner_start;

CREATE UNIQUE INDEX bookings_practitioner_start ON bookings (practitioner_id, start_utc);
