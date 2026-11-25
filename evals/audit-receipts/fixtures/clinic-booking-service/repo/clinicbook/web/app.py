"""Turns a method, target, headers and body into a Response. The socket server lives in server.py."""

from __future__ import annotations

import logging
from collections.abc import Callable, Mapping
from datetime import datetime
from urllib.parse import parse_qs, urlsplit

from clinicbook import auth, db
from clinicbook.config import Config
from clinicbook.errors import AppError, Unauthorized
from clinicbook.timeutil import utcnow
from clinicbook.web import handlers  # noqa: F401  registers the routes
from clinicbook.web import router
from clinicbook.web.request import Request, Response, error_response, json_response

log = logging.getLogger(__name__)

MAX_BODY_BYTES = 64 * 1024


class App:
    def __init__(self, config: Config, sms, payments, clock: Callable[[], datetime] = utcnow) -> None:
        self.config = config
        self.sms = sms
        self.payments = payments
        self.clock = clock

    def handle(self, method: str, target: str, headers: Mapping[str, str], body: bytes = b"") -> Response:
        parts = urlsplit(target)
        query = {key: values[-1] for key, values in parse_qs(parts.query).items()}
        if len(body) > MAX_BODY_BYTES:
            return json_response(413, {"error": {"code": "too_large", "message": "request body is too large"}})
        try:
            route, params = router.resolve(method, parts.path)
        except AppError as exc:
            return error_response(exc)
        token = _bearer_token(headers)
        conn = db.connect(self.config.db_path)
        try:
            now = self.clock()
            user = auth.authenticate(conn, token, now) if token else None
            if route.signed_in and user is None:
                raise Unauthorized("sign in first")
            request = Request(method, parts.path, params, query, body, conn, now, self, user, token)
            result = route.handler(request)
            return result if isinstance(result, Response) else json_response(200, result)
        except AppError as exc:
            return error_response(exc)
        except Exception:
            log.exception("unhandled error in %s %s", method, parts.path)
            return json_response(500, {"error": {"code": "internal", "message": "something went wrong"}})
        finally:
            conn.close()


def _bearer_token(headers: Mapping[str, str]) -> str | None:
    for name, value in headers.items():
        if name.lower() == "authorization":
            scheme, _, token = value.partition(" ")
            if scheme.lower() == "bearer" and token.strip():
                return token.strip()
    return None
