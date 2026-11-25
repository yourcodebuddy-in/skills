"""Log format for the command-line tool."""

import logging
import sys

FORMAT = "%(asctime)s %(levelname)s %(name)s: %(message)s"


def configure(level: str) -> None:
    handler = logging.StreamHandler(sys.stderr)
    handler.setFormatter(logging.Formatter(FORMAT))
    root = logging.getLogger("usagebill")
    root.handlers[:] = [handler]
    root.setLevel(level)
    root.propagate = False
