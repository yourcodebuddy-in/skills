import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import helpers

from usagebill.config import ConfigError, load_settings


class CommandTests(unittest.TestCase):
    """Runs ``python -m usagebill`` the way the cron jobs do."""

    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.tmp = Path(self._tmp.name)
        self.env = {
            "PATH": os.environ.get("PATH", ""),
            "PYTHONDONTWRITEBYTECODE": "1",
            "USAGEBILL_DB": str(self.tmp / "cli.db"),
            "USAGEBILL_PLANS": str(helpers.ROOT / "config" / "plans.json"),
        }

    def tearDown(self):
        self._tmp.cleanup()

    def run_cli(self, *args, check=True):
        result = subprocess.run(
            [sys.executable, "-m", "usagebill", *args],
            cwd=helpers.ROOT,
            env=self.env,
            capture_output=True,
            text=True,
            timeout=60,
        )
        if check and result.returncode != 0:
            self.fail(f"usagebill {' '.join(args)} exited {result.returncode}: {result.stderr}")
        return result

    def test_commands_need_a_migrated_database(self):
        result = self.run_cli("invoice", "list", check=False)
        self.assertEqual(result.returncode, 2)
        self.assertIn("run `usagebill migrate` first", result.stderr)

    def test_month_end_flow(self):
        self.assertIn("applied migrations: 1, 2, 3, 4", self.run_cli("migrate").stdout)
        self.run_cli("customers", "add", "--account", "northwind", "--name", "Northwind", "--plan", "starter", "--country", "GB")
        usage = helpers.ROOT / "examples" / "usage-2026-10.csv"

        dry = self.run_cli("import", "--account", "northwind", "--dry-run", str(usage))
        self.assertIn("would import 6 rows", dry.stdout)
        self.assertIn("imported 6 rows", self.run_cli("import", "--account", "northwind", str(usage)).stdout)

        again = self.run_cli("import", "--account", "northwind", str(usage), check=False)
        self.assertEqual(again.returncode, 1)
        self.assertIn("already imported", again.stderr)

        self.assertIn("created 1", self.run_cli("invoice", "generate", "--period", "2026-10").stdout)
        self.assertIn("finalized 1", self.run_cli("invoice", "finalize", "--period", "2026-10").stdout)
        listing = self.run_cli("invoice", "list", "--status", "finalized").stdout
        self.assertIn("202610-NORTHWIND", listing)

        out = self.tmp / "exports"
        self.assertIn("wrote 2 files", self.run_cli("export", "--period", "2026-10", "--out", str(out)).stdout)
        self.assertTrue((out / "202610-NORTHWIND.csv").exists())

    def test_bad_input_is_reported_without_traceback(self):
        self.run_cli("migrate")
        result = self.run_cli(
            "customers", "add", "--account", "Bad Name", "--name", "x", "--plan", "starter", "--country", "GB", check=False
        )
        self.assertEqual(result.returncode, 2)
        self.assertNotIn("Traceback", result.stderr)
        result = self.run_cli("invoice", "list", "--sort", "nonsense", check=False)
        self.assertEqual(result.returncode, 2)
        self.assertIn("can't sort by", result.stderr)

    def test_send_without_webhook_settings(self):
        self.run_cli("migrate")
        result = self.run_cli("send", check=False)
        self.assertEqual(result.returncode, 2)
        self.assertIn("USAGEBILL_WEBHOOK_URL", result.stderr)


class SettingsTests(unittest.TestCase):
    def test_defaults(self):
        settings = load_settings({})
        self.assertEqual(settings.db_path, "usagebill.db")
        self.assertEqual(settings.plans_path, "config/plans.json")
        self.assertEqual(settings.log_level, "INFO")
        self.assertIsNone(settings.webhook_url)

    def test_reads_environment(self):
        settings = load_settings(
            {
                "USAGEBILL_DB": "/data/b.db",
                "USAGEBILL_LOG_LEVEL": "debug",
                "USAGEBILL_WEBHOOK_URL": "https://a.example.com/x",
                "USAGEBILL_WEBHOOK_TOKEN": "secret-value",
            }
        )
        self.assertEqual(settings.db_path, "/data/b.db")
        self.assertEqual(settings.log_level, "DEBUG")
        self.assertNotIn("secret-value", repr(settings))

    def test_bad_log_level(self):
        with self.assertRaises(ConfigError):
            load_settings({"USAGEBILL_LOG_LEVEL": "LOUD"})


if __name__ == "__main__":
    unittest.main()
