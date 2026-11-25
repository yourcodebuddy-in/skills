# 2. Store instants as UTC text, convert at the edges

Date: 2025-09-10. Status: accepted.

## Context

Clinics are in four US time zones. Patients and staff think in the clinic's wall-clock time; reminders, fees and the 24-hour rules need exact instants. SQLite has no time type.

## Decision

- Every instant is stored as UTC text in exactly one format, `YYYY-MM-DDTHH:MM:SSZ`, written only by `timeutil.to_db`. Because the format is fixed width, comparing two stored values as strings orders them in time, so queries compare and sort them directly.
- The clinic's IANA zone is converted at the edges only: input local times are read in the clinic's zone (`timeutil.local_to_utc`), output is shown in it, and anything that works in clinic days turns the day into a UTC range in the clinic's zone first (`timeutil.day_bounds`).
- Working hours are stored as wall-clock `HH:MM` and turned into instants per day, so a slot at 09:00 stays at 09:00 across daylight-saving changes.

## Consequences

- Stored values can be read by eye and compared in plain SQL.
- Python's `zoneinfo` needs the system time-zone database, which the image installs.
