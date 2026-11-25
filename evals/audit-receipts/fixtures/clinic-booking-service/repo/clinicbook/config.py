"""Settings: config/default.json, then an optional JSON file, then environment variables."""

from __future__ import annotations

import json
import os
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path

DEFAULT_FILE = Path(__file__).resolve().parent.parent / "config" / "default.json"

ENV_NAMES = {
    "db_path": "CLINICBOOK_DB",
    "host": "CLINICBOOK_HOST",
    "port": "CLINICBOOK_PORT",
    "session_hours": "CLINICBOOK_SESSION_HOURS",
    "worker_interval_seconds": "CLINICBOOK_WORKER_INTERVAL",
    "sms_url": "CLINICBOOK_SMS_URL",
    "sms_api_key": "CLINICBOOK_SMS_API_KEY",
    "sms_sender": "CLINICBOOK_SMS_SENDER",
    "sms_timeout_seconds": "CLINICBOOK_SMS_TIMEOUT",
    "payments_url": "CLINICBOOK_PAYMENTS_URL",
    "payments_api_key": "CLINICBOOK_PAYMENTS_API_KEY",
    "log_level": "CLINICBOOK_LOG_LEVEL",
}

_INTS = {"port", "session_hours", "worker_interval_seconds"}
_FLOATS = {"sms_timeout_seconds"}
_OPTIONAL = {"sms_url", "sms_api_key", "payments_url", "payments_api_key"}


@dataclass(frozen=True)
class Config:
    db_path: str
    host: str
    port: int
    session_hours: int
    worker_interval_seconds: int
    sms_url: str | None
    sms_api_key: str | None
    sms_sender: str
    sms_timeout_seconds: float
    payments_url: str | None
    payments_api_key: str | None
    log_level: str


def _coerce(name: str, raw: object) -> object:
    if raw is None or raw == "":
        if name in _OPTIONAL:
            return None
        raise ValueError(f"setting {name} must not be empty")
    try:
        if name in _INTS:
            return int(raw)
        if name in _FLOATS:
            return float(raw)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"setting {name} must be a number, got {raw!r}") from exc
    return str(raw)


def load(path: str | os.PathLike | None = None, environ: Mapping[str, str] | None = None) -> Config:
    environ = os.environ if environ is None else environ
    values = json.loads(DEFAULT_FILE.read_text())
    extra = path or environ.get("CLINICBOOK_CONFIG")
    if extra:
        values.update(json.loads(Path(extra).read_text()))
    unknown = set(values) - set(ENV_NAMES)
    if unknown:
        raise ValueError(f"unknown settings: {', '.join(sorted(unknown))}")
    for name, env_name in ENV_NAMES.items():
        if env_name in environ:
            values[name] = environ[env_name]
    config = Config(**{name: _coerce(name, values.get(name)) for name in ENV_NAMES})
    if config.sms_url and not config.sms_api_key:
        raise ValueError("sms_url is set but sms_api_key is not")
    if config.payments_url and not config.payments_api_key:
        raise ValueError("payments_url is set but payments_api_key is not")
    return config
