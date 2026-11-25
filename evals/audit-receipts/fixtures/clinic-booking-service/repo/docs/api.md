# API

JSON in and out. Signed-in endpoints take `Authorization: Bearer <token>` from `POST /api/login`. Request bodies are limited to 64 KB.

Errors look like `{"error": {"code": "slot_taken", "message": "that time has just been booked"}}`, with these statuses: 400 `invalid`, 401 `unauthorized`, 403 `forbidden`, 404 `not_found`, 405 `method_not_allowed`, 409 `conflict`, `slot_taken` or `limit_reached`, 413 `too_large`, 500 `internal`.

A record that belongs to another clinic, or for a patient to another patient, answers 404, the same as one that doesn't exist.

Local times are the clinic's wall-clock time as `YYYY-MM-DDTHH:MM`. Every booking also carries `start_utc` and `end_utc`.

## Public

| Method and path | Body or query | Returns |
| --- | --- | --- |
| `GET /healthz` | | `{"status": "ok"}` |
| `POST /api/login` | `email`, `password` | `token`, `expires_in_hours` |
| `POST /api/clinics/{slug}/register` | `name`, `email`, `password` (10 or more characters), optional `phone`, `card_ref` | 201, `patient` |
| `GET /api/clinics/{slug}/practitioners` | | `clinic`, `practitioners` (active only) |
| `GET /api/clinics/{slug}/practitioners/{id}/slots` | `?date=YYYY-MM-DD` | `date`, `timezone`, open `slots` |

Registration creates a patient record and a patient account at that clinic. An email can have one account in the whole group.

## Signed in

| Method and path | Who | Body or query | Returns |
| --- | --- | --- | --- |
| `POST /api/logout` | anyone | | `{"status": "signed_out"}` |
| `POST /api/bookings` | patient, staff, admin | `practitioner_id`, `start`; staff and admins also `patient_id` | 201, `booking` |
| `GET /api/bookings` | patient | | the patient's upcoming bookings |
| `GET /api/bookings` | staff, admin | `?date=` (default today at the clinic) | that day's bookings, every status |
| `GET /api/bookings/{id}` | patient (own), staff, admin | | `booking` |
| `POST /api/bookings/{id}/cancel` | patient (own), staff, admin | | `booking` |
| `POST /api/bookings/{id}/reschedule` | patient (own), staff, admin | `start` | `booking` |
| `POST /api/bookings/{id}/complete` | staff, admin | | `booking` |
| `POST /api/bookings/{id}/no-show` | staff, admin | | `booking` |
| `GET /api/patients` | staff, admin | `?sort=name\|newest\|email`, `?q=` (name or email contains), `?limit=` (default 50, at most 200) | `patients` |
| `POST /api/patients` | staff, admin | `name`, `email`, optional `phone` | 201, `patient` |
| `GET /api/patients/{id}` | patient (own), staff, admin | | `patient` |
| `PUT /api/patients/{id}/card` | patient (own), staff, admin | `card_ref` from the payment widget | `patient` |
| `GET /api/export/bookings.csv` | admin | `?from=YYYY-MM-DD&to=YYYY-MM-DD`, at most 92 days | CSV file |

Phone numbers are US or Canadian and are stored as `+1` and ten digits.

## Booking outcomes

- `POST /api/bookings` answers 409 `slot_taken` if someone else got the time first, 409 `limit_reached` if the patient already has three upcoming bookings at the clinic, and 400 if the time isn't one of the practitioner's slots, has passed, or is more than 60 days ahead.
- Cancelling or moving a booking that isn't `booked`, or that has started, answers 409. A patient moving a booking within 24 hours of its start also gets 409.
- `complete` and `no-show` answer 409 until the appointment has ended.

## CSV export

Columns: `booking_id, date, time, practitioner, patient, email, phone, status, price_cents, fees_charged_cents`. Date and time are local to the clinic. `fees_charged_cents` counts fees the provider accepted. Text cells that a spreadsheet would read as a formula are prefixed with `'`.
