"""clinicbook/ics.py is never imported or called anywhere in the project."""
import os
import re
import sys
from pathlib import Path

root = Path(os.getcwd())
pattern = re.compile(r"clinicbook\.ics|from clinicbook import[^\n]*\bics\b|import ics\b|booking_to_ics|(?<![\w])ics\.py")
hits = []
for path in root.rglob("*"):
    if not path.is_file() or ".git" in path.parts or path == root / "clinicbook" / "ics.py":
        continue
    try:
        text = path.read_text()
    except UnicodeDecodeError:
        continue
    hits += [f"{path.relative_to(root)}: {line.strip()}" for line in text.splitlines() if pattern.search(line)]
print("references:", hits or "none")
sys.exit(0 if (root / "clinicbook" / "ics.py").exists() and not hits else 1)
