import csv, os, sys, tempfile
sys.path.insert(0, os.getcwd())
from ledger.export import export_entries
from ledger.model import Entry
with tempfile.TemporaryDirectory() as d:
    p = os.path.join(d, "o.csv")
    export_entries(p, [Entry("d", "kept", 1250), Entry("d", "gone", 100, archived=True)])
    rows = list(csv.reader(open(p, newline="")))
sys.exit(0 if len(rows) == 3 and rows[1][2] == "12.5" else 1)
