"""Booking policy values shared by the API, the worker and the CLI."""

# A patient may hold this many upcoming bookings at one clinic.
MAX_UPCOMING_BOOKINGS = 3

# Cancelling or rescheduling at least this long before the start is free.
FREE_CANCEL_HOURS = 24

# Share of the booking price charged for a late cancellation or a missed appointment.
LATE_CANCEL_PERCENT = 50
NO_SHOW_PERCENT = 100

# Reminders are queued this long before the appointment.
REMINDER_LEAD_HOURS = 24

# How far ahead patients can book, counted in the clinic's own calendar days.
BOOKING_HORIZON_DAYS = 60

# Rows handled per worker pass.
OUTBOX_BATCH_SIZE = 50
FEE_BATCH_SIZE = 20

# Longest date range one CSV export may cover.
EXPORT_MAX_DAYS = 92

# Sign-in attempts and expired sessions older than this are purged.
RETENTION_DAYS = 30

CURRENCY_SYMBOLS = {"USD": "$", "CAD": "$"}

ROLES = ("admin", "staff", "patient")
STAFF_ROLES = ("admin", "staff")
