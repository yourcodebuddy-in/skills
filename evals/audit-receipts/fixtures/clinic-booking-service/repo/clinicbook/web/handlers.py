"""HTTP endpoints. docs/api.md describes each one."""

from __future__ import annotations

import io
from typing import Any

from clinicbook import auth, bookings, clinics, db, export, patients, practitioners, reminders, slots
from clinicbook.bookings import Booking
from clinicbook.clinics import Clinic
from clinicbook.constants import STAFF_ROLES
from clinicbook.errors import NotFound, ValidationError
from clinicbook.patients import Patient
from clinicbook.timeutil import from_db, local_today, parse_day, parse_local, to_local
from clinicbook.validation import (
    normalize_email,
    normalize_phone,
    optional_text,
    parse_limit,
    require_int,
    require_password,
    require_text,
)
from clinicbook.web.request import Request, Response, json_response
from clinicbook.web.router import route


def _booking_json(booking: Booking, clinic: Clinic) -> dict[str, Any]:
    start = to_local(from_db(booking.start_utc), clinic.timezone)
    return {
        "id": booking.id,
        "practitioner_id": booking.practitioner_id,
        "patient_id": booking.patient_id,
        "start": start.strftime("%Y-%m-%dT%H:%M"),
        "start_utc": booking.start_utc,
        "end_utc": booking.end_utc,
        "status": booking.status,
        "price_cents": booking.price_cents,
    }


def _patient_json(patient: Patient) -> dict[str, Any]:
    return {
        "id": patient.id,
        "name": patient.name,
        "email": patient.email,
        "phone": patient.phone,
        "has_card": patient.card_ref is not None,
    }


def _day(raw: str | None) -> Any:
    try:
        return parse_day(raw)
    except ValueError as exc:
        raise ValidationError(str(exc)) from exc


def _clinic(req: Request) -> Clinic:
    return clinics.get_clinic(req.conn, req.user.clinic_id)


def _visible_booking(req: Request) -> Booking:
    """A booking in the caller's clinic; for a patient, only one of their own."""
    booking = bookings.get_booking_for_clinic(req.conn, req.user.clinic_id, req.params["booking_id"])
    if req.user.role == "patient" and booking.patient_id != req.user.patient_id:
        raise NotFound("booking not found")
    return booking


def _visible_patient_id(req: Request) -> int:
    patient_id = req.params["patient_id"]
    if req.user.role == "patient" and patient_id != req.user.patient_id:
        raise NotFound("patient not found")
    return patient_id


@route("GET", "/healthz", signed_in=False)
def health(req: Request) -> dict[str, str]:
    req.conn.execute("SELECT 1").fetchone()
    return {"status": "ok"}


@route("POST", "/api/login", signed_in=False)
def login(req: Request) -> dict[str, Any]:
    body = req.json()
    hours = req.app.config.session_hours
    token = auth.login(req.conn, body.get("email"), body.get("password"), req.now, hours)
    return {"token": token, "expires_in_hours": hours}


@route("POST", "/api/logout")
def logout(req: Request) -> dict[str, str]:
    auth.logout(req.conn, req.token)
    return {"status": "signed_out"}


@route("POST", "/api/clinics/{slug:slug}/register", signed_in=False)
def register(req: Request) -> Response:
    clinic = clinics.get_clinic_by_slug(req.conn, req.params["slug"])
    body = req.json()
    name = require_text(body, "name", max_length=120)
    email = normalize_email(body.get("email"))
    phone = normalize_phone(body.get("phone"))
    password_hash = auth.hash_password(require_password(body))
    card_ref = optional_text(body, "card_ref", max_length=64)
    with db.transaction(req.conn, immediate=True):
        patient = patients.create_patient(
            req.conn, clinic.id, name=name, email=email, phone=phone, card_ref=card_ref, now=req.now
        )
        auth.create_user(req.conn, clinic.id, email, password_hash, "patient", req.now, patient_id=patient.id)
    return json_response(201, {"patient": _patient_json(patient)})


@route("GET", "/api/clinics/{slug:slug}/practitioners", signed_in=False)
def list_practitioners(req: Request) -> dict[str, Any]:
    clinic = clinics.get_clinic_by_slug(req.conn, req.params["slug"])
    found = practitioners.list_practitioners(req.conn, clinic.id)
    return {
        "clinic": {"slug": clinic.slug, "name": clinic.name, "timezone": clinic.timezone, "currency": clinic.currency},
        "practitioners": [
            {
                "id": p.id,
                "name": p.name,
                "specialty": p.specialty,
                "slot_minutes": p.slot_minutes,
                "price_cents": p.price_cents,
            }
            for p in found
        ],
    }


@route("GET", "/api/clinics/{slug:slug}/practitioners/{practitioner_id:int}/slots", signed_in=False)
def list_slots(req: Request) -> dict[str, Any]:
    clinic = clinics.get_clinic_by_slug(req.conn, req.params["slug"])
    practitioner = practitioners.get_practitioner(req.conn, clinic.id, req.params["practitioner_id"])
    day = _day(req.query.get("date"))
    found = slots.available_slots(req.conn, clinic, practitioner, day, req.now)
    return {
        "date": day.isoformat(),
        "timezone": clinic.timezone,
        "slots": [{"start": s.local_start, "start_utc": s.start_utc, "end_utc": s.end_utc} for s in found],
    }


@route("POST", "/api/bookings")
def create_booking(req: Request) -> Response:
    body = req.json()
    clinic = _clinic(req)
    practitioner = practitioners.get_practitioner(req.conn, clinic.id, require_int(body, "practitioner_id"))
    patient_id = req.user.patient_id if req.user.role == "patient" else require_int(body, "patient_id")
    patient = patients.get_patient(req.conn, clinic.id, patient_id)
    try:
        start = parse_local(require_text(body, "start"))
    except ValueError as exc:
        raise ValidationError(str(exc)) from exc
    booking = bookings.create_booking(req.conn, clinic, practitioner, patient, start, req.now)
    return json_response(201, {"booking": _booking_json(booking, clinic)})


@route("GET", "/api/bookings")
def list_bookings(req: Request) -> dict[str, Any]:
    clinic = _clinic(req)
    if req.user.role == "patient":
        found = bookings.list_upcoming_for_patient(req.conn, clinic.id, req.user.patient_id, req.now)
    else:
        day = _day(req.query["date"]) if "date" in req.query else local_today(req.now, clinic.timezone)
        found = bookings.list_for_day(req.conn, clinic, day)
    return {"bookings": [_booking_json(b, clinic) for b in found]}


@route("GET", "/api/bookings/{booking_id:int}")
def get_booking(req: Request) -> dict[str, Any]:
    return {"booking": _booking_json(_visible_booking(req), _clinic(req))}


@route("POST", "/api/bookings/{booking_id:int}/cancel")
def cancel_booking(req: Request) -> dict[str, Any]:
    booking = bookings.get_booking(req.conn, req.params["booking_id"])
    if booking is None or (req.user.role == "patient" and booking.patient_id != req.user.patient_id):
        raise NotFound("booking not found")
    clinic = clinics.get_clinic(req.conn, booking.clinic_id)
    cancelled = bookings.cancel_booking(req.conn, booking, clinic, req.now, by_patient=req.user.role == "patient")
    return {"booking": _booking_json(cancelled, clinic)}


@route("POST", "/api/bookings/{booking_id:int}/reschedule")
def reschedule_booking(req: Request) -> dict[str, Any]:
    booking = _visible_booking(req)
    clinic = _clinic(req)
    practitioner = practitioners.get_practitioner(req.conn, clinic.id, booking.practitioner_id)
    try:
        start = parse_local(require_text(req.json(), "start"))
    except ValueError as exc:
        raise ValidationError(str(exc)) from exc
    moved = bookings.reschedule_booking(
        req.conn, booking, clinic, practitioner, start, req.now, by_patient=req.user.role == "patient"
    )
    patient = patients.get_patient(req.conn, clinic.id, moved.patient_id)
    if patient.phone:
        label = reminders.local_time_label(moved.start_utc, clinic.timezone)
        req.app.sms.send(patient.phone, reminders.reschedule_text(clinic.name, practitioner.name, label))
    return {"booking": _booking_json(moved, clinic)}


@route("POST", "/api/bookings/{booking_id:int}/complete")
def complete_booking(req: Request) -> dict[str, Any]:
    auth.require_role(req.user, *STAFF_ROLES)
    done = bookings.complete_booking(req.conn, _visible_booking(req), req.now)
    return {"booking": _booking_json(done, _clinic(req))}


@route("POST", "/api/bookings/{booking_id:int}/no-show")
def mark_no_show(req: Request) -> dict[str, Any]:
    auth.require_role(req.user, *STAFF_ROLES)
    clinic = _clinic(req)
    missed = bookings.mark_no_show(req.conn, _visible_booking(req), clinic, req.now)
    return {"booking": _booking_json(missed, clinic)}


@route("GET", "/api/patients")
def list_patients(req: Request) -> dict[str, Any]:
    auth.require_role(req.user, *STAFF_ROLES)
    limit = parse_limit(req.query.get("limit"), default=patients.DEFAULT_PAGE_SIZE, maximum=patients.MAX_PAGE_SIZE)
    found = patients.list_patients(
        req.conn,
        req.user.clinic_id,
        sort=req.query.get("sort", "name"),
        search=req.query.get("q"),
        limit=limit,
    )
    return {"patients": [_patient_json(p) for p in found]}


@route("POST", "/api/patients")
def create_patient(req: Request) -> Response:
    auth.require_role(req.user, *STAFF_ROLES)
    body = req.json()
    patient = patients.create_patient(
        req.conn,
        req.user.clinic_id,
        name=require_text(body, "name", max_length=120),
        email=body.get("email"),
        phone=body.get("phone"),
        now=req.now,
    )
    return json_response(201, {"patient": _patient_json(patient)})


@route("GET", "/api/patients/{patient_id:int}")
def get_patient(req: Request) -> dict[str, Any]:
    patient = patients.get_patient(req.conn, req.user.clinic_id, _visible_patient_id(req))
    return {"patient": _patient_json(patient)}


@route("PUT", "/api/patients/{patient_id:int}/card")
def set_card(req: Request) -> dict[str, Any]:
    card_ref = require_text(req.json(), "card_ref", max_length=64)
    patient = patients.set_card(req.conn, req.user.clinic_id, _visible_patient_id(req), card_ref)
    return {"patient": _patient_json(patient)}


@route("GET", "/api/export/bookings.csv")
def export_bookings(req: Request) -> Response:
    auth.require_role(req.user, "admin")
    clinic = _clinic(req)
    first_day, last_day = _day(req.query.get("from")), _day(req.query.get("to"))
    out = io.StringIO()
    export.write_bookings_csv(req.conn, clinic, first_day, last_day, out)
    filename = f"bookings-{clinic.slug}-{first_day.isoformat()}-{last_day.isoformat()}.csv"
    return Response(
        200,
        out.getvalue().encode(),
        "text/csv; charset=utf-8",
        {"Content-Disposition": f'attachment; filename="{filename}"'},
    )
