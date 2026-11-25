"""Migration 4 copies discount_cents into tax_cents and back, for existing invoices.

Exit 0 when an invoice written at schema version 3 has its tax and discount
swapped after `migrate`.
"""
import os
import sys
import tempfile
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, os.getcwd())

from usagebill import migrations
from usagebill.db import connect

with tempfile.TemporaryDirectory() as tmp:
    conn = connect(Path(tmp) / "p.db")
    migrations.migrate(conn, target=3)
    conn.execute("INSERT INTO customers (account, name, plan, country, created_at) VALUES ('northwind', 'N', 'starter', 'GB', 'x')")
    conn.execute(
        """INSERT INTO invoices (customer_id, period, number, status, subtotal_cents, discount_cents, tax_rate,
                                 tax_cents, total_cents, issued_on, due_on, created_at)
           VALUES (1, '2026-08', '202608-NORTHWIND', 'sent', 10000, 1000, '20', 1800, 10800,
                   '2026-09-01', '2026-10-01', 'x')"""
    )
    conn.execute("INSERT INTO invoice_lines (invoice_id, position, description, amount_cents) VALUES (1, 1, 'Starter plan', 10000)")
    conn.commit()
    applied = migrations.migrate(conn)
    row = conn.execute("SELECT subtotal_cents, discount_cents, tax_cents, total_cents FROM invoices").fetchone()
    print(f"applied {applied}; after: subtotal={row[0]} discount={row[1]} tax={row[2]} total={row[3]}")
    print("before: subtotal=10000 discount=1000 tax=1800 total=10800")
    conn.close()
sys.exit(0 if (row[1], row[2]) == (1800, 1000) else 1)
