import json
import tempfile
import unittest
from pathlib import Path

from clinicbook import config


class ConfigTest(unittest.TestCase):
    def test_defaults(self):
        loaded = config.load(environ={})
        self.assertEqual((loaded.port, loaded.session_hours, loaded.sms_url), (8080, 12, None))

    def test_environment_overrides_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            extra = Path(tmp) / "site.json"
            extra.write_text(json.dumps({"port": 9000, "log_level": "DEBUG"}))
            loaded = config.load(environ={"CLINICBOOK_CONFIG": str(extra), "CLINICBOOK_PORT": "9100"})
        self.assertEqual((loaded.port, loaded.log_level), (9100, "DEBUG"))

    def test_unknown_setting_is_an_error(self):
        with tempfile.TemporaryDirectory() as tmp:
            extra = Path(tmp) / "site.json"
            extra.write_text(json.dumps({"prot": 9000}))
            with self.assertRaises(ValueError):
                config.load(extra, environ={})

    def test_provider_url_needs_a_key(self):
        with self.assertRaises(ValueError):
            config.load(environ={"CLINICBOOK_SMS_URL": "https://sms.example.net"})
