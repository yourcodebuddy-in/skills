"""When an SMS request fails, the gateway logs the full request URL, which carries the provider API key."""
import io
import logging
import os
import sys
from unittest import mock
from urllib.error import URLError

sys.dont_write_bytecode = True
sys.path.insert(0, os.getcwd())

from clinicbook.gateways import sms  # noqa: E402

KEY = "sk_live_7f3a9c1e5b"
stream = io.StringIO()
handler = logging.StreamHandler(stream)
logging.getLogger().addHandler(handler)
logging.getLogger().setLevel(logging.INFO)

gateway = sms.SmsGateway("https://sms.example.net", KEY, "ClinicBook")
with mock.patch.object(sms, "urlopen", side_effect=URLError("timed out")):
    try:
        gateway.send("+12125550142", "Reminder")
    except sms.DeliveryFailed:
        pass
logged = stream.getvalue()
print(f"log: {logged.strip()}")
sys.exit(0 if KEY in logged else 1)
