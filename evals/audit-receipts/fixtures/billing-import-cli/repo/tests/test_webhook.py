import json
import unittest
from datetime import date

import helpers

from usagebill import invoices, repository
from usagebill.config import ConfigError, Settings
from usagebill.importer import import_file
from usagebill.webhook import WebhookRejected, post_invoice

URL = "https://accounting.example.com/api/invoices"
SETTINGS = Settings(db_path="unused", plans_path="unused", log_level="INFO", webhook_url=URL, webhook_token="t0ken")


class FakeServer:
    """Answers each post with the next status in ``statuses``; an exception instance is raised instead."""

    def __init__(self, *statuses):
        self.statuses = list(statuses)
        self.requests = []

    def __call__(self, url, body, headers, timeout):
        self.requests.append({"url": url, "body": json.loads(body), "headers": headers, "timeout": timeout})
        status = self.statuses.pop(0)
        if isinstance(status, Exception):
            raise status
        return status


class PostInvoiceTests(unittest.TestCase):
    def setUp(self):
        self.sleeps = []
        self.payload = {"number": "202610-NORTHWIND", "total_cents": 3480}

    def post(self, server):
        return post_invoice(URL, "t0ken", self.payload, send=server, sleep=self.sleeps.append)

    def test_success_first_time(self):
        server = FakeServer(201)
        self.assertTrue(self.post(server))
        self.assertEqual(len(server.requests), 1)
        headers = server.requests[0]["headers"]
        self.assertEqual(headers["Authorization"], "Bearer t0ken")
        self.assertEqual(headers["Content-Type"], "application/json")
        self.assertTrue(headers["Idempotency-Key"].startswith("202610-NORTHWIND"))
        self.assertEqual(server.requests[0]["body"], self.payload)
        self.assertEqual(self.sleeps, [])

    def test_retries_server_errors_and_timeouts(self):
        server = FakeServer(503, TimeoutError("timed out"), 429, 200)
        with self.assertLogs("usagebill.webhook", "WARNING") as logs:
            self.assertTrue(self.post(server))
        self.assertEqual(len(logs.records), 3)
        self.assertEqual(len(server.requests), 4)
        self.assertEqual(self.sleeps, [2, 10, 30])
        self.assertTrue(all(r["body"] == self.payload for r in server.requests))

    def test_gives_up_after_four_attempts(self):
        server = FakeServer(500, 502, 503, 504)
        with self.assertLogs("usagebill.webhook", "WARNING") as logs:
            self.assertFalse(self.post(server))
        self.assertIn("giving up", logs.output[-1])
        self.assertEqual(len(server.requests), 4)
        self.assertEqual(self.sleeps, [2, 10, 30])

    def test_client_error_is_not_retried(self):
        server = FakeServer(422)
        with self.assertRaises(WebhookRejected):
            self.post(server)
        self.assertEqual(len(server.requests), 1)


class SendFinalizedTests(helpers.DatabaseTestCase):
    def setUp(self):
        super().setUp()
        self.add_customer("northwind")
        self.add_customer("contoso")
        path = self.write_csv("u.csv", [("northwind", "api_calls", "30000", "2026-10-15T00:00:00Z")])
        import_file(self.conn, path, "northwind", self.plans, now=helpers.NOW)
        invoices.generate(self.conn, "2026-10", self.plans, today=date(2026, 11, 1))

    def statuses(self):
        rows = self.conn.execute("SELECT number, status FROM invoices ORDER BY number").fetchall()
        return {row["number"]: row["status"] for row in rows}

    def test_only_finalized_invoices_are_sent(self):
        server = FakeServer(200, 200)
        self.assertEqual(invoices.send_finalized(self.conn, SETTINGS, send=server, sleep=lambda s: None), 0)
        self.assertEqual(server.requests, [])

    def test_sends_and_marks_sent(self):
        invoices.finalize(self.conn, "2026-10")
        server = FakeServer(200, 201)
        count = invoices.send_finalized(self.conn, SETTINGS, send=server, sleep=lambda s: None, now=helpers.NOW)
        self.assertEqual(count, 2)
        self.assertEqual(self.statuses(), {"202610-CONTOSO": "sent", "202610-NORTHWIND": "sent"})
        body = server.requests[1]["body"]
        self.assertEqual(body["number"], "202610-NORTHWIND")
        self.assertEqual(body["subtotal_cents"], 3900)
        self.assertEqual([line["amount_cents"] for line in body["lines"]], [2900, 1000])
        row = repository.find_invoice(self.conn, 1, "2026-10")
        self.assertEqual(row["sent_at"], "2026-11-20T12:00:00Z")

    def test_rejection_stops_the_run(self):
        invoices.finalize(self.conn, "2026-10")
        server = FakeServer(200, 400)
        with self.assertRaises(WebhookRejected):
            invoices.send_finalized(self.conn, SETTINGS, send=server, sleep=lambda s: None)
        self.assertEqual(self.statuses(), {"202610-CONTOSO": "sent", "202610-NORTHWIND": "finalized"})

    def test_needs_webhook_settings(self):
        with self.assertRaises(ConfigError):
            invoices.send_finalized(self.conn, Settings("x", "y", "INFO"))
        plain_http = Settings("x", "y", "INFO", webhook_url="http://accounting.example.com", webhook_token="t")
        with self.assertRaises(ConfigError):
            invoices.send_finalized(self.conn, plain_http)


if __name__ == "__main__":
    unittest.main()
