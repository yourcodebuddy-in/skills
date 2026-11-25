"""Input checks shared by the API and the CLI."""

from __future__ import annotations

import re

from clinicbook.errors import ValidationError

EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
NON_DIGITS = re.compile(r"\D")
MIN_PASSWORD_LENGTH = 10
MAX_PASSWORD_LENGTH = 200


def normalize_email(raw: object) -> str:
    if not isinstance(raw, str):
        raise ValidationError("email is required")
    email = raw.strip().lower()
    if len(email) > 254 or not EMAIL_PATTERN.match(email):
        raise ValidationError("email is not valid")
    return email


def normalize_phone(raw: object) -> str | None:
    """Store North American numbers as E.164 (+1 and ten digits). Blank means no phone."""
    if raw is None:
        return None
    if not isinstance(raw, str):
        raise ValidationError("phone must be text")
    if not raw.strip():
        return None
    digits = NON_DIGITS.sub("", raw)
    if len(digits) == 11 and digits.startswith("1"):
        digits = digits[1:]
    if len(digits) != 10:
        raise ValidationError("phone must be a 10-digit US or Canadian number")
    return f"+1{digits}"


def require_text(payload: dict, field: str, *, max_length: int = 200) -> str:
    value = payload.get(field)
    if not isinstance(value, str) or not value.strip():
        raise ValidationError(f"{field} is required")
    value = value.strip()
    if len(value) > max_length:
        raise ValidationError(f"{field} is longer than {max_length} characters")
    return value


def optional_text(payload: dict, field: str, *, max_length: int = 200) -> str | None:
    if payload.get(field) in (None, ""):
        return None
    return require_text(payload, field, max_length=max_length)


def require_int(payload: dict, field: str) -> int:
    value = payload.get(field)
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError(f"{field} must be a whole number")
    return value


def require_password(payload: dict) -> str:
    value = payload.get("password")
    if not isinstance(value, str) or len(value) < MIN_PASSWORD_LENGTH:
        raise ValidationError(f"password must be at least {MIN_PASSWORD_LENGTH} characters")
    if len(value) > MAX_PASSWORD_LENGTH:
        raise ValidationError(f"password must be at most {MAX_PASSWORD_LENGTH} characters")
    return value


def parse_limit(raw: str | None, *, default: int, maximum: int) -> int:
    if raw is None:
        return default
    if not raw.isdigit() or int(raw) < 1:
        raise ValidationError("limit must be a positive whole number")
    return min(int(raw), maximum)
