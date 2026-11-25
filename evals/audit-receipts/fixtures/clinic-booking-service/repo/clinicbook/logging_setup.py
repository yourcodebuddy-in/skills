"""Log format for the server and the worker: one line per record on stderr."""

from __future__ import annotations

import logging
import sys

FORMAT = "%(asctime)s %(levelname)s %(name)s %(message)s"


def configure(level: str) -> None:
    handler = logging.StreamHandler(sys.stderr)
    handler.setFormatter(logging.Formatter(FORMAT))
    root = logging.getLogger()
    root.handlers[:] = [handler]
    root.setLevel(level.upper())
