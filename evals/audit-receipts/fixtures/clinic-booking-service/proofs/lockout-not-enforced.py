"""docs/security.md says five failed sign-ins lock an email for 15 minutes, even with the right password.
The code records attempts but never checks them: the right password works straight after ten failures."""
import os
import sys
from pathlib import Path

sys.dont_write_bytecode = True
sys.path[:0] = [os.getcwd(), os.path.join(os.getcwd(), "tests")]

from helpers import PASSWORD, ClinicTestCase  # noqa: E402

doc = Path("docs/security.md").read_text()
claim = "After five failed attempts for an email within 15 minutes, that email can't sign in for the next 15 minutes"
if claim not in doc:
    print("claim not found in docs/security.md")
    sys.exit(1)

case = ClinicTestCase()
case.setUp()
try:
    case.add_user(case.east, "desk@harbor.example", "staff")
    failures = [
        case.call("POST", "/api/login", body={"email": "desk@harbor.example", "password": f"guess-number-{i}"})[0]
        for i in range(10)
    ]
    status, body = case.call("POST", "/api/login", body={"email": "desk@harbor.example", "password": PASSWORD})
finally:
    case.doCleanups()
print(f"ten wrong passwords -> {set(failures)}; right password straight after -> {status}, token issued: {'token' in body}")
sys.exit(0 if set(failures) == {401} and status == 200 and "token" in body else 1)
