"""test_percent_discount_respects_cap passes even when the cap is removed.

It calls assertTrue(amount, 5000), which only checks that amount is truthy.
Exit 0 when, in a temp copy with the cap line deleted, the code returns 20000
for the test's input and the test still passes.
"""
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

CAP_LINE = "            amount = min(amount, rule.max_cents)\n"

with tempfile.TemporaryDirectory() as tmp:
    copy = Path(tmp) / "repo"
    shutil.copytree(os.getcwd(), copy, ignore=shutil.ignore_patterns("__pycache__", ".git"))
    target = copy / "usagebill" / "discounts.py"
    source = target.read_text()
    assert source.count(CAP_LINE) == 1, "cap line not found"
    target.write_text(source.replace(CAP_LINE, "            pass\n"))
    env = {**os.environ, "PYTHONDONTWRITEBYTECODE": "1"}
    broken = subprocess.run(
        [sys.executable, "-B", "-c",
         "from usagebill.discounts import discount_cents, parse_rule; print(discount_cents(200_000, parse_rule('percent:10:5000')))"],
        cwd=copy, env=env, capture_output=True, text=True, timeout=60,
    )
    test = subprocess.run(
        [sys.executable, "-B", "-m", "unittest", "discover", "-s", "tests", "-k", "test_percent_discount_respects_cap"],
        cwd=copy, env=env, capture_output=True, text=True, timeout=120,
    )
print(f"broken code returns {broken.stdout.strip()} (cap is 5000); test exit {test.returncode}: {test.stderr.strip().splitlines()[-3:]}")
sys.exit(0 if broken.stdout.strip() == "20000" and test.returncode == 0 and "Ran 1 test" in test.stderr else 1)
