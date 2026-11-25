"""iCalendar (RFC 5545) text for a booking, so patients can add it to their calendar."""

from __future__ import annotations

from datetime import datetime

from clinicbook.bookings import Booking
from clinicbook.timeutil import from_db

PRODUCT_ID = "-//ClinicBook//Bookings//EN"
ICS_TIME = "%Y%m%dT%H%M%SZ"


def _escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


def _fold(line: str) -> list[str]:
    """Split a content line into 75-octet pieces, continuation lines starting with a space."""
    pieces = []
    data = line.encode()
    while len(data) > 75:
        cut = 75
        while cut > 0 and (data[cut] & 0xC0) == 0x80:
            cut -= 1
        pieces.append(data[:cut].decode())
        data = b" " + data[cut:]
    pieces.append(data.decode())
    return pieces


def booking_to_ics(booking: Booking, clinic_name: str, practitioner_name: str, now: datetime) -> str:
    status = "CANCELLED" if booking.status == "cancelled" else "CONFIRMED"
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        f"PRODID:{PRODUCT_ID}",
        "METHOD:PUBLISH",
        "BEGIN:VEVENT",
        f"UID:booking-{booking.id}@clinicbook",
        f"DTSTAMP:{now.strftime(ICS_TIME)}",
        f"DTSTART:{from_db(booking.start_utc).strftime(ICS_TIME)}",
        f"DTEND:{from_db(booking.end_utc).strftime(ICS_TIME)}",
        f"SUMMARY:{_escape(f'Appointment with {practitioner_name}')}",
        f"LOCATION:{_escape(clinic_name)}",
        f"STATUS:{status}",
        "END:VEVENT",
        "END:VCALENDAR",
    ]
    folded = [piece for line in lines for piece in _fold(line)]
    return "\r\n".join(folded) + "\r\n"
