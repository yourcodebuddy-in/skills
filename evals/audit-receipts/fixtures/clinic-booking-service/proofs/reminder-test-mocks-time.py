"""test_reminder_names_the_appointment_time mocks out local_time_label, the time-zone conversion it is
meant to check. With local_time_label broken to print UTC, the whole suite still passes."""
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

sys.dont_write_bytecode = True

work = Path(tempfile.mkdtemp(prefix="proof-mocked-test-"))
try:
    copy = work / "repo"
    shutil.copytree(os.getcwd(), copy, ignore=shutil.ignore_patterns(".git", "__pycache__"))
    target = copy / "clinicbook" / "reminders.py"
    source = target.read_text()
    original = "    return format_slot(to_local(from_db(start_utc), tz))\n"
    if original not in source:
        print("local_time_label not found")
        sys.exit(1)
    target.write_text(source.replace(original, "    return format_slot(from_db(start_utc))\n"))

    env = {**os.environ, "PYTHONDONTWRITEBYTECODE": "1"}
    check = subprocess.run(
        [sys.executable, "-c",
         "from clinicbook.reminders import local_time_label; print(local_time_label('2026-03-03T14:00:00Z', 'America/New_York'))"],
        cwd=copy, env=env, capture_output=True, text=True,
    )
    suite = subprocess.run(
        [sys.executable, "-m", "unittest", "discover", "-s", "tests"], cwd=copy, env=env, capture_output=True, text=True
    )
    print(f"broken label for 09:00 New York: {check.stdout.strip()}")
    print(f"suite with the broken label: exit {suite.returncode}; {suite.stderr.strip().splitlines()[-1]}")
    ok = check.stdout.strip() == "Tue 03 Mar at 14:00" and suite.returncode == 0
finally:
    shutil.rmtree(work, ignore_errors=True)
sys.exit(0 if ok else 1)
