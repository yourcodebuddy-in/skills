import contextlib
import io
import os
from unittest import mock

from helpers import ClinicTestCase

from clinicbook import cli


class CliTest(ClinicTestCase):
    def run_cli(self, *args, env=None):
        out, err = io.StringIO(), io.StringIO()
        environ = {"CLINICBOOK_DB": self.db_path, "CLINICBOOK_LOG_LEVEL": "WARNING", **(env or {})}
        with mock.patch.dict(os.environ, environ), contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            code = cli.main(list(args))
        return code, out.getvalue(), err.getvalue()

    def test_migrate_on_an_up_to_date_database(self):
        self.assertEqual(self.run_cli("migrate")[:2], (0, "database is up to date\n"))

    def test_create_clinic_and_staff_account(self):
        code, out, _ = self.run_cli("create-clinic", "lakeside", "Lakeside", "America/Chicago")
        self.assertEqual(code, 0)
        self.assertIn("created clinic lakeside", out)
        code, out, _ = self.run_cli(
            "create-user", "lakeside", "desk@lakeside.example", "staff", env={"CLINICBOOK_NEW_PASSWORD": "long enough pw"}
        )
        self.assertEqual(code, 0)

    def test_bad_time_zone_is_reported(self):
        code, _, err = self.run_cli("create-clinic", "nowhere", "Nowhere", "Mars/Olympus")
        self.assertEqual(code, 2)
        self.assertIn("unknown time zone", err)

    def test_import_patients(self):
        path = self.tmp / "patients.csv"
        path.write_text(
            "name,email,phone\n"
            "Rae Holt,rae@example.com,(212) 555-0177\n"
            "Sam Lee,SAM@example.com,\n"
            "No Email,,212-555-0100\n"
        )
        self.add_patient(self.east, "sam@example.com")
        code, out, err = self.run_cli("import-patients", "harbor-east", str(path))
        self.assertEqual(code, 1)
        self.assertIn("created 1, skipped 1 already on file, 1 errors", out)
        self.assertIn("line 4", err)
        phone = self.conn.execute("SELECT phone FROM patients WHERE email = 'rae@example.com'").fetchone()[0]
        self.assertEqual(phone, "+12125550177")

    def test_backup_refuses_to_overwrite(self):
        dest = self.tmp / "copy.sqlite3"
        self.assertEqual(self.run_cli("backup", str(dest))[0], 0)
        self.assertTrue(dest.exists())
        self.assertEqual(self.run_cli("backup", str(dest))[0], 1)
