"""Phone numbers are normalised twice: validation.normalize_phone (API) and importer._phone (CSV import).
They disagree on a number written with the leading 1, so imported patients get an invalid number."""
import io
import os
import sys

sys.dont_write_bytecode = True
sys.path[:0] = [os.getcwd(), os.path.join(os.getcwd(), "tests")]

from helpers import ClinicTestCase  # noqa: E402

from clinicbook import importer  # noqa: E402
from clinicbook.validation import normalize_phone  # noqa: E402

raw = "1-212-555-0142"
api_value = normalize_phone(raw)
import_value = importer._phone(raw)

case = ClinicTestCase()
case.setUp()
try:
    importer.import_patients(case.conn, case.east.id, io.StringIO(f"name,email,phone\nRae Holt,rae@example.com,{raw}\n"), case.now)
    stored = case.conn.execute("SELECT phone FROM patients WHERE email = 'rae@example.com'").fetchone()[0]
finally:
    case.doCleanups()
print(f"{raw!r}: API stores {api_value}, import stores {stored}")
sys.exit(0 if api_value == "+12125550142" and import_value == stored == "+112125550142" else 1)
