"""usagebill/fx.py is never imported or referenced.

Exit 0 when no other file in the repo mentions the module or its functions.
"""
import re
import sys
from pathlib import Path

pattern = re.compile(r"usagebill\.fx\b|from usagebill import[^\n]*\bfx\b|\bimport fx\b|\bfx\.|convert_cents|RATES_TO_GBP|UnknownCurrency")
hits = []
for path in Path(".").rglob("*"):
    if not path.is_file() or ".git" in path.parts or "__pycache__" in path.parts or path.as_posix() == "usagebill/fx.py":
        continue
    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        continue
    hits += [f"{path}: {m.group(0)}" for m in pattern.finditer(text)]
print(f"fx.py exists: {Path('usagebill/fx.py').exists()}; references elsewhere: {hits}")
sys.exit(0 if Path("usagebill/fx.py").exists() and not hits else 1)
