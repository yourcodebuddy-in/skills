"""HTTP server: reads the request off the socket, hands it to App.handle and writes the response."""

from __future__ import annotations

import logging
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from clinicbook.web.app import MAX_BODY_BYTES, App

log = logging.getLogger(__name__)

SOCKET_TIMEOUT_SECONDS = 30


class _Handler(BaseHTTPRequestHandler):
    app: App
    server_version = "clinicbook"
    protocol_version = "HTTP/1.1"
    timeout = SOCKET_TIMEOUT_SECONDS

    def _reply(self, status: int, body: bytes, content_type: str, headers: dict[str, str]) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for name, value in headers.items():
            self.send_header(name, value)
        self.end_headers()
        self.wfile.write(body)

    def _serve(self) -> None:
        raw_length = self.headers.get("Content-Length") or "0"
        if not raw_length.isdigit():
            self.close_connection = True
            self._reply(400, b'{"error": {"code": "invalid", "message": "bad Content-Length"}}', "application/json", {})
            return
        length = int(raw_length)
        if length > MAX_BODY_BYTES:
            self.close_connection = True
            self._reply(413, b'{"error": {"code": "too_large", "message": "request body is too large"}}', "application/json", {})
            return
        body = self.rfile.read(length) if length else b""
        response = self.app.handle(self.command, self.path, dict(self.headers.items()), body)
        self._reply(response.status, response.body, response.content_type, response.headers)

    do_GET = _serve
    do_POST = _serve
    do_PUT = _serve
    do_DELETE = _serve

    def log_message(self, format: str, *args: object) -> None:
        log.info("%s %s", self.address_string(), format % args)


def make_server(app: App, host: str, port: int) -> ThreadingHTTPServer:
    handler = type("Handler", (_Handler,), {"app": app})
    server = ThreadingHTTPServer((host, port), handler)
    server.daemon_threads = True
    return server
