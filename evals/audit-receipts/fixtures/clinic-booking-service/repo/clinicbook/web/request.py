"""The request and response objects handlers work with."""

from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from clinicbook.auth import User
from clinicbook.errors import AppError, ValidationError


@dataclass
class Response:
    status: int
    body: bytes
    content_type: str = "application/json"
    headers: dict[str, str] = field(default_factory=dict)


def json_response(status: int, payload: Any) -> Response:
    return Response(status, json.dumps(payload).encode())


def error_response(error: AppError) -> Response:
    return json_response(error.status, {"error": {"code": error.code, "message": error.message}})


@dataclass
class Request:
    method: str
    path: str
    params: dict[str, Any]
    query: dict[str, str]
    body: bytes
    conn: sqlite3.Connection
    now: datetime
    app: Any
    user: User | None
    token: str | None

    def json(self) -> dict[str, Any]:
        if not self.body:
            return {}
        try:
            data = json.loads(self.body)
        except (UnicodeDecodeError, ValueError) as exc:
            raise ValidationError("the request body must be JSON") from exc
        if not isinstance(data, dict):
            raise ValidationError("the request body must be a JSON object")
        return data
