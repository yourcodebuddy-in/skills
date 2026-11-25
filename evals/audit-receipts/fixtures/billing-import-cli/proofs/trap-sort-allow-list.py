"""Trap (safe-pattern): list_invoices puts `sort` into SQL with an f-string.

The interpolated text is only ever a value of SORT_COLUMNS (looked up by key)
and one of two literal directions; anything else raises before SQL is built.
Exit 0 when every allowed sort runs, hostile values are refused, and the
interpolated pieces can only come from those fixed values.
"""
import ast
import os
import sys
import tempfile
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, os.getcwd())

from usagebill import migrations, repository
from usagebill.db import connect

source = Path("usagebill/repository.py").read_text()
func = next(n for n in ast.walk(ast.parse(source)) if isinstance(n, ast.FunctionDef) and n.name == "list_invoices")
func_src = ast.get_source_segment(source, func)
structure_ok = (
    "column = SORT_COLUMNS.get(sort)" in func_src
    and "if column is None:" in func_src
    and 'direction = "DESC" if descending else "ASC"' in func_src
    and 'f" ORDER BY {column} {direction}, i.id"' in func_src
    and "status = ?" in func_src
)

with tempfile.TemporaryDirectory() as tmp:
    conn = connect(Path(tmp) / "p.db")
    migrations.migrate(conn)
    allowed_ok = True
    for key in repository.SORT_COLUMNS:
        for desc in (False, True):
            for status in (None, "draft", "x' OR 1=1 --"):
                repository.list_invoices(conn, status=status, sort=key, descending=desc)
    refused = 0
    hostile = ["period; DROP TABLE invoices", "i.period", "(SELECT 1)", "1", "period--", "", "PERIOD", "total DESC"]
    for value in hostile:
        try:
            repository.list_invoices(conn, sort=value)
        except ValueError:
            refused += 1
    tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    conn.close()
print(f"structure ok: {structure_ok}; refused {refused}/{len(hostile)} hostile sorts; invoices table intact: {'invoices' in tables}")
sys.exit(0 if structure_ok and allowed_ok and refused == len(hostile) and "invoices" in tables else 1)
