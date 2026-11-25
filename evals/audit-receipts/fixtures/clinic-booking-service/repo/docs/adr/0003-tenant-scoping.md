# 3. Scope every request to the user's clinic

Date: 2025-09-12. Status: accepted.

## Context

Clinics share one database. A front-desk account at one clinic must never see or change another clinic's patients or bookings, and a patient only their own.

## Decision

- Every account belongs to exactly one clinic, and `req.user.clinic_id` is the only source of the clinic for a signed-in request. Clinic ids are never taken from the request body or query.
- Lookups by id take the clinic id as well, such as `bookings.get_booking_for_clinic(conn, clinic_id, booking_id)` and `patients.get_patient(conn, clinic_id, patient_id)`, and answer 404 when the record belongs elsewhere, so ids from other clinics can't be probed.
- Patients are further limited to their own records in the handler.
- Public endpoints name the clinic by slug in the path and return only what a patient choosing a slot needs.

## Consequences

- Every new query on clinic data needs a `clinic_id` condition, and every new endpoint needs a test that another clinic's record answers 404.
