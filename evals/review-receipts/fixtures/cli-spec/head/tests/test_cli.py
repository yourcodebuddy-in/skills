import csv
import os
import tempfile
import unittest

from ledger.cli import main
from ledger.model import Entry


class CliTest(unittest.TestCase):
    def test_unknown_command(self):
        self.assertEqual(main(["nope"], []), 2)

    def test_export_writes_header_and_quotes_commas(self):
        with tempfile.TemporaryDirectory() as folder:
            path = os.path.join(folder, "out.csv")
            main(["export", path], [Entry("2026-01-01", "Coffee, beans", 1200)])
            with open(path, newline="") as handle:
                rows = list(csv.reader(handle))
        self.assertEqual(rows[0], ["date", "description", "amount"])
        self.assertEqual(rows[1][1], "Coffee, beans")


if __name__ == "__main__":
    unittest.main()
