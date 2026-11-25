"""list_patients puts `sort` into SQL with an f-string, but only after mapping it through SORT_COLUMNS;
any other value is refused before a query runs. The search text is a bound parameter."""
import os
import sys

sys.dont_write_bytecode = True
sys.path[:0] = [os.getcwd(), os.path.join(os.getcwd(), "tests")]

from helpers import ClinicTestCase  # noqa: E402

from clinicbook import patients  # noqa: E402
from clinicbook.errors import ValidationError  # noqa: E402

hostile = [
    "name; DROP TABLE patients",
    "name COLLATE NOCASE, id",
    "(SELECT password_hash FROM users)",
    "email--",
    "1",
    "",
    "NAME",
    "name ",
]
case = ClinicTestCase()
case.setUp()
problems = []
try:
    case.add_patient(case.east, "sam@example.com")
    case.add_patient(case.west, "lou@example.com")
    executed = []
    case.conn.set_trace_callback(executed.append)
    for value in hostile:
        executed.clear()
        try:
            patients.list_patients(case.conn, case.east.id, sort=value)
            problems.append(f"accepted {value!r}")
        except ValidationError:
            if any("FROM patients" in sql for sql in executed):
                problems.append(f"queried before refusing {value!r}")
    for key, clause in patients.SORT_COLUMNS.items():
        executed.clear()
        patients.list_patients(case.conn, case.east.id, sort=key, search="' OR 1=1 --")
        if not any(sql.endswith(f"ORDER BY {clause} LIMIT 50") for sql in executed):
            problems.append(f"unexpected SQL for {key}: {executed}")
    case.conn.set_trace_callback(None)

    staff = case.add_user(case.east, "desk@harbor.example", "staff")
    status, _ = case.call("GET", "/api/patients?sort=name%3B%20DROP%20TABLE%20patients", token=staff)
    _, body = case.call("GET", "/api/patients?q=%25", token=staff)
    count = case.conn.execute("SELECT COUNT(*) FROM patients").fetchone()[0]
    if status != 400 or count != 2 or [p["email"] for p in body["patients"]] != ["sam@example.com"]:
        problems.append(f"api: status {status}, patients {count}, wildcard search {body}")
finally:
    case.doCleanups()
print("problems:", problems or "none")
sys.exit(0 if not problems else 1)
