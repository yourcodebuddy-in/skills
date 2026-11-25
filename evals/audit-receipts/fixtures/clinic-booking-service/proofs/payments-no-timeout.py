"""PaymentGateway.charge calls urlopen with no timeout, and Python's default is to wait forever, so a
provider that stops answering hangs the single worker (reminders, messages and fees all stop)."""
import io
import json
import os
import socket
import sys
from unittest import mock

sys.dont_write_bytecode = True
sys.path.insert(0, os.getcwd())

from clinicbook.gateways import payments, sms  # noqa: E402

calls = {}


def fake_urlopen(*args, **kwargs):
    calls.setdefault("args", args)
    calls.setdefault("kwargs", kwargs)
    return io.BytesIO(json.dumps({"id": "ch_1"}).encode())


with mock.patch.object(payments, "urlopen", side_effect=fake_urlopen):
    payments.PaymentGateway("https://pay.example.net", "key").charge("card_ok", 1000, "USD", "fee")
payment_timeout = calls["kwargs"].get("timeout", calls["args"][2] if len(calls["args"]) > 2 else None)

calls.clear()
with mock.patch.object(sms, "urlopen", side_effect=fake_urlopen):
    sms.SmsGateway("https://sms.example.net", "key", "ClinicBook").send("+12125550142", "hi")
sms_timeout = calls["kwargs"].get("timeout")

print(f"payments urlopen timeout: {payment_timeout}; sms urlopen timeout: {sms_timeout}; "
      f"socket default timeout: {socket.getdefaulttimeout()}")
sys.exit(0 if payment_timeout is None and sms_timeout and socket.getdefaulttimeout() is None else 1)
