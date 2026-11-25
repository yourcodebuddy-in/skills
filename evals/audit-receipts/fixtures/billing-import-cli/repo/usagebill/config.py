"""Settings read from the environment."""

import os
from collections.abc import Mapping
from dataclasses import dataclass, field

from usagebill import constants


class ConfigError(RuntimeError):
    """Raised when a setting a command needs is missing or invalid."""


@dataclass(frozen=True)
class Settings:
    db_path: str
    plans_path: str
    log_level: str
    webhook_url: str | None = None
    webhook_token: str | None = field(default=None, repr=False)

    def require_webhook(self) -> tuple[str, str]:
        if not self.webhook_url or not self.webhook_token:
            raise ConfigError("USAGEBILL_WEBHOOK_URL and USAGEBILL_WEBHOOK_TOKEN must both be set")
        if not self.webhook_url.startswith("https://"):
            raise ConfigError("USAGEBILL_WEBHOOK_URL must use https")
        return self.webhook_url, self.webhook_token


def _get(env: Mapping[str, str], name: str) -> str | None:
    value = env.get(name, "").strip()
    return value or None


def load_settings(env: Mapping[str, str] | None = None) -> Settings:
    source = os.environ if env is None else env
    level = (_get(source, "USAGEBILL_LOG_LEVEL") or constants.DEFAULT_LOG_LEVEL).upper()
    if level not in {"DEBUG", "INFO", "WARNING", "ERROR"}:
        raise ConfigError(f"USAGEBILL_LOG_LEVEL must be DEBUG, INFO, WARNING or ERROR, got {level}")
    return Settings(
        db_path=_get(source, "USAGEBILL_DB") or constants.DEFAULT_DB_PATH,
        plans_path=_get(source, "USAGEBILL_PLANS") or constants.DEFAULT_PLANS_PATH,
        log_level=level,
        webhook_url=_get(source, "USAGEBILL_WEBHOOK_URL"),
        webhook_token=_get(source, "USAGEBILL_WEBHOOK_TOKEN"),
    )
