"""Path templates such as /api/bookings/{booking_id:int} matched to handler functions."""

from __future__ import annotations

import re
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from clinicbook.errors import MethodNotAllowed, NotFound

_PARAM = re.compile(r"\{(\w+)(?::(int|slug))?\}")
_KINDS = {
    "int": (r"[0-9]{1,18}", int),
    "slug": (r"[a-z0-9-]{1,40}", str),
    None: (r"[^/]+", str),
}


@dataclass(frozen=True)
class Route:
    method: str
    pattern: re.Pattern[str]
    converters: dict[str, Callable[[str], Any]]
    handler: Callable[..., Any]
    signed_in: bool


_ROUTES: list[Route] = []


def _compile(template: str) -> tuple[re.Pattern[str], dict[str, Callable[[str], Any]]]:
    parts = ["^"]
    converters = {}
    position = 0
    for match in _PARAM.finditer(template):
        name, kind = match.group(1), match.group(2)
        regex, converter = _KINDS[kind]
        parts.append(re.escape(template[position : match.start()]))
        parts.append(f"(?P<{name}>{regex})")
        converters[name] = converter
        position = match.end()
    parts.append(re.escape(template[position:]))
    parts.append("$")
    return re.compile("".join(parts)), converters


def route(method: str, template: str, *, signed_in: bool = True) -> Callable:
    """Register a handler. signed_in=False makes the route public."""

    def register(handler: Callable) -> Callable:
        pattern, converters = _compile(template)
        _ROUTES.append(Route(method, pattern, converters, handler, signed_in))
        return handler

    return register


def resolve(method: str, path: str) -> tuple[Route, dict[str, Any]]:
    path_matched = False
    for candidate in _ROUTES:
        match = candidate.pattern.match(path)
        if match is None:
            continue
        if candidate.method != method:
            path_matched = True
            continue
        params = {name: candidate.converters[name](value) for name, value in match.groupdict().items()}
        return candidate, params
    if path_matched:
        raise MethodNotAllowed(f"{method} isn't allowed here")
    raise NotFound("no such endpoint")
