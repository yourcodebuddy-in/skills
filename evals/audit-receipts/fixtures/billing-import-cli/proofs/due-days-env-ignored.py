"""README documents USAGEBILL_DUE_DAYS; the code never reads it.

Exit 0 when the README lists the variable, nothing in the package reads it,
and an invoice generated through the CLI with USAGEBILL_DUE_DAYS=14 is still
due 30 days after issue.
"""
import os
import subprocess
import sys
import tempfile
from datetime import date
from pathlib import Path

documented = "`USAGEBILL_DUE_DAYS` | `30` |" in Path("README.md").read_text()
readers = [p for p in Path("usagebill").rglob("*.py") if "USAGEBILL_DUE_DAYS" in p.read_text()]

with tempfile.TemporaryDirectory() as tmp:
    env = {
        "PATH": os.environ.get("PATH", ""),
        "PYTHONDONTWRITEBYTECODE": "1",
        "USAGEBILL_DB": str(Path(tmp) / "p.db"),
        "USAGEBILL_PLANS": str(Path("config/plans.json").resolve()),
        "USAGEBILL_DUE_DAYS": "14",
    }

    def run(*args):
        subprocess.run([sys.executable, "-B", "-m", "usagebill", *args], env=env, check=True, capture_output=True, timeout=60)

    run("migrate")
    run("customers", "add", "--account", "northwind", "--name", "N", "--plan", "starter", "--country", "GB")
    run("invoice", "generate", "--period", "2026-10")
    import sqlite3

    conn = sqlite3.connect(Path(tmp) / "p.db")
    issued, due = conn.execute("SELECT issued_on, due_on FROM invoices").fetchone()
    conn.close()
days = (date.fromisoformat(due) - date.fromisoformat(issued)).days
print(f"documented={documented} readers={readers} issued={issued} due={due} days={days}")
sys.exit(0 if documented and not readers and days == 30 else 1)
