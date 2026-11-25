#!/usr/bin/env python3
"""Tests for skills/audit-receipts/scripts/audit.py. Each one builds a small git repo in a temp folder.

    python3 evals/audit-receipts/test_audit.py
"""

import os
import subprocess
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[2] / "skills" / "audit-receipts" / "scripts" / "audit.py"

ORDERS = textwrap.dedent(
    """\
    def create_order(customer, fee):
        order = find(customer)
        total = order.total + fee
        return total


    def refund(order, amount):
        if amount > order.total:
            raise ValueError("refund larger than order")
        return order.total - amount
    """
)


def run(args, cwd):
    result = subprocess.run([sys.executable, str(SCRIPT), *args], cwd=cwd, capture_output=True, text=True, check=False)
    return result.returncode, result.stdout + result.stderr


class Repo:
    def __init__(self, files):
        self.dir = tempfile.TemporaryDirectory()
        self.root = Path(self.dir.name)
        for path, text in files.items():
            (self.root / path).parent.mkdir(parents=True, exist_ok=True)
            (self.root / path).write_text(text, encoding="utf-8")
        env = {**os.environ, "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@example.com", "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@example.com"}
        for command in (["git", "init", "-q"], ["git", "add", "."], ["git", "commit", "-q", "-m", "init"]):
            subprocess.run(command, cwd=self.root, check=True, env=env, capture_output=True)
        self.audit = self.root / "audits" / "a"

    def scope(self, *extra):
        return run(["scope", "--out", str(self.audit), *extra], self.root)

    def write(self, name, text):
        path = self.audit / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(textwrap.dedent(text), encoding="utf-8")

    def check(self):
        return run(["check", str(self.audit)], self.root)

    def spots(self):
        code, out = run(["spots", str(self.audit)], self.root)
        return [p for row in out.splitlines() for p in row.split(": ", 1)[1].split()]

    def close(self):
        self.dir.cleanup()


def complete_ledger(repo):
    """A ledger that should pass: one confirmed finding at the bar with proof, every file noted and spot-checked."""
    repo.write(
        "notes/S1.txt",
        """\
        Some prose the reviewer wrote around its lines.
        FILE src/orders.py: creates orders and refunds; checked the fee path, refunds over the total, a missing order; S1-1
        FILE src/util.py: a single helper that doubles a number; checked callers and the return value
        FIND S1-1 src/orders.py:3 bar bug: a first order has no total, so adding the fee raises and the order fails
        CITE S1-1 src/orders.py:3: total = order.total + fee
        FIX S1-1: default the total to 0 in find()
        """,
    )
    spot_lines = "\n".join(f"SPOT {p}: accurate: the note matches what the file does" for p in repo.spots())
    repo.write(
        "verify/S1.txt",
        "VERDICT S1-1 Confirmed: ran create_order for a new customer in a temp copy and it raised AttributeError\n"
        "PROOF S1-1: python -c \"create_order(new, 1)\" raised AttributeError: 'NoneType' object has no attribute 'total'\n"
        + spot_lines
        + "\n",
    )
    repo.write(
        "lead.txt",
        """\
        SCORE orders 7/10: S1-1 breaks every first order
        SUMMARY: one bug at the bar breaks first orders
        """,
    )


class AuditTests(unittest.TestCase):
    def setUp(self):
        self.repo = Repo({"src/orders.py": ORDERS, "src/util.py": "def double(x):\n    return x * 2\n", "package-lock.json": "{}\n"})
        code, out = self.repo.scope()
        self.assertEqual(code, 0, out)

    def tearDown(self):
        self.repo.close()

    def test_scope_lists_text_files_and_excludes_lock_files(self):
        scope = (self.repo.audit / "scope.tsv").read_text()
        self.assertIn("S1\tsrc/orders.py\t10", scope)
        self.assertIn("excluded\tpackage-lock.json", scope)
        self.assertIn("# commit ", scope)

    def test_complete_ledger_passes_and_report_reconciles(self):
        complete_ledger(self.repo)
        code, out = self.repo.check()
        self.assertEqual(code, 0, out)
        self.assertIn("PASS", out)
        code, out = run(["report", str(self.repo.audit)], self.repo.root)
        self.assertEqual(code, 0, out)
        report = (self.repo.audit / "REPORT.md").read_text()
        self.assertIn("## At the release bar (1)", report)
        self.assertIn("S1-1", report)
        self.assertIn("1 findings raised", report)

    def test_file_without_a_note_is_not_covered(self):
        complete_ledger(self.repo)
        notes = (self.repo.audit / "notes/S1.txt").read_text().replace("FILE src/util.py", "# FILE src/util.py")
        (self.repo.audit / "notes/S1.txt").write_text(notes)
        code, out = self.repo.check()
        self.assertEqual(code, 1)
        self.assertIn("NOT COVERED  S1 src/util.py", out)

    def test_thin_note_is_rejected(self):
        complete_ledger(self.repo)
        notes = (self.repo.audit / "notes/S1.txt").read_text().replace("a single helper that doubles a number; checked callers and the return value", "fine")
        (self.repo.audit / "notes/S1.txt").write_text(notes)
        code, out = self.repo.check()
        self.assertIn("THIN NOTE    src/util.py", out)

    def test_quote_not_in_file_fails(self):
        complete_ledger(self.repo)
        notes = (self.repo.audit / "notes/S1.txt").read_text().replace("total = order.total + fee", "total = order.amount + fee")
        (self.repo.audit / "notes/S1.txt").write_text(notes)
        code, out = self.repo.check()
        self.assertIn("BAD CITE     S1-1 src/orders.py:3: that text isn't in the file", out)

    def test_quote_at_wrong_line_fails(self):
        complete_ledger(self.repo)
        notes = (self.repo.audit / "notes/S1.txt").read_text().replace("CITE S1-1 src/orders.py:3", "CITE S1-1 src/orders.py:9")
        (self.repo.audit / "notes/S1.txt").write_text(notes)
        code, out = self.repo.check()
        self.assertIn("the quote is at line 3, not 9", out)

    def test_citation_reads_the_scoped_commit_not_later_edits(self):
        complete_ledger(self.repo)
        (self.repo.root / "src/orders.py").write_text("# rewritten\n")
        code, out = self.repo.check()
        self.assertEqual(code, 0, out)

    def test_finding_without_verdict_fails(self):
        complete_ledger(self.repo)
        (self.repo.audit / "verify/S1.txt").write_text("\n".join(f"SPOT {p}: accurate: the note matches the file" for p in self.repo.spots()))
        code, out = self.repo.check()
        self.assertIn("NO VERDICT   S1-1", out)

    def test_refuted_needs_quoted_disproof(self):
        complete_ledger(self.repo)
        verify = (self.repo.audit / "verify/S1.txt").read_text()
        verify = verify.replace("VERDICT S1-1 Confirmed: ran create_order for a new customer in a temp copy and it raised AttributeError", "VERDICT S1-1 Refuted: callers never pass a new customer today")
        (self.repo.audit / "verify/S1.txt").write_text(verify)
        (self.repo.audit / "lead.txt").write_text("SCORE orders 10/10: nothing found\nSUMMARY: fine\n")
        code, out = self.repo.check()
        self.assertIn("NO DISPROOF  S1-1", out)

    def test_refuted_with_real_disproof_passes(self):
        self.repo.write(
            "notes/S1.txt",
            """\
            FILE src/orders.py: creates orders and refunds; checked refunds over the total; S1-1
            FILE src/util.py: a single helper that doubles a number; checked callers and the return value
            FIND S1-1 src/orders.py:10 high bug: a refund larger than the order gives a negative total
            CITE S1-1 src/orders.py:10: return order.total - amount
            """,
        )
        spot_lines = "\n".join(f"SPOT {p}: accurate: the note matches what the file does" for p in self.repo.spots())
        self.repo.write(
            "verify/S1.txt",
            "VERDICT S1-1 Refuted: refund() raises before subtracting when the amount is larger\n"
            "REFUTE S1-1 src/orders.py:8: if amount > order.total:\n" + spot_lines + "\n",
        )
        self.repo.write("lead.txt", "SCORE orders 10/10: nothing found above nit\nSUMMARY: healthy\n")
        code, out = self.repo.check()
        self.assertEqual(code, 0, out)

    def test_bar_finding_needs_proof(self):
        complete_ledger(self.repo)
        verify = "\n".join(row for row in (self.repo.audit / "verify/S1.txt").read_text().splitlines() if not row.startswith("PROOF"))
        (self.repo.audit / "verify/S1.txt").write_text(verify)
        code, out = self.repo.check()
        self.assertIn("BAR UNPROVEN S1-1", out)

    def test_likely_bar_finding_is_unproven(self):
        complete_ledger(self.repo)
        verify = (self.repo.audit / "verify/S1.txt").read_text().replace("VERDICT S1-1 Confirmed", "VERDICT S1-1 Likely")
        (self.repo.audit / "verify/S1.txt").write_text(verify)
        code, out = self.repo.check()
        self.assertIn("BAR UNPROVEN S1-1", out)

    def test_overstated_must_lower_the_severity(self):
        complete_ledger(self.repo)
        verify = (self.repo.audit / "verify/S1.txt").read_text().replace("VERDICT S1-1 Confirmed: ran", "VERDICT S1-1 Overstated: ran")
        (self.repo.audit / "verify/S1.txt").write_text(verify + "SEVERITY S1-1 bar: still bad\n")
        code, out = self.repo.check()
        self.assertIn("NOT LOWER    S1-1", out)

    def test_overstated_with_lower_severity_passes_and_drops_from_bar(self):
        complete_ledger(self.repo)
        verify = (self.repo.audit / "verify/S1.txt").read_text().replace("VERDICT S1-1 Confirmed: ran", "VERDICT S1-1 Overstated: ran")
        (self.repo.audit / "verify/S1.txt").write_text(verify + "SEVERITY S1-1 medium: only new customers, and they retry\n")
        code, out = self.repo.check()
        self.assertEqual(code, 0, out)
        run(["report", str(self.repo.audit)], self.repo.root)
        report = (self.repo.audit / "REPORT.md").read_text()
        self.assertIn("## Medium (1)", report)
        self.assertIn("lowered from bar", report)

    def test_missing_spot_check_fails(self):
        complete_ledger(self.repo)
        verify = "\n".join(row for row in (self.repo.audit / "verify/S1.txt").read_text().splitlines() if not row.startswith("SPOT"))
        (self.repo.audit / "verify/S1.txt").write_text(verify)
        code, out = self.repo.check()
        self.assertIn("NEED SPOT", out)

    def test_wrong_spot_check_fails(self):
        complete_ledger(self.repo)
        verify = (self.repo.audit / "verify/S1.txt").read_text().replace(": accurate:", ": wrong:", 1)
        (self.repo.audit / "verify/S1.txt").write_text(verify)
        code, out = self.repo.check()
        self.assertIn("SPOT WRONG", out)

    def test_score_must_name_findings_and_not_refuted_ones(self):
        complete_ledger(self.repo)
        (self.repo.audit / "lead.txt").write_text("SCORE orders 7/10: it felt messy\nSUMMARY: ok\n")
        code, out = self.repo.check()
        self.assertIn("SCORE REASON orders: name the finding IDs", out)
        (self.repo.audit / "lead.txt").write_text("SCORE orders 7/10: S9-9 is bad\nSUMMARY: ok\n")
        code, out = self.repo.check()
        self.assertIn("S9-9 isn't a finding", out)

    def test_duplicate_merges_into_one_entry_and_still_counts(self):
        complete_ledger(self.repo)
        self.repo.write(
            "notes/F1.txt",
            """\
            FILE src/orders.py: traced the order flow from create_order through find(); S1-1 again as F1-1
            FIND F1-1 src/orders.py:3 high bug: the fee is added to a missing total for new customers
            CITE F1-1 src/orders.py:3: total = order.total + fee
            """,
        )
        self.repo.write("lead2.txt", "DUP F1-1 of S1-1\n")
        code, out = self.repo.check()
        self.assertEqual(code, 0, out)
        run(["report", str(self.repo.audit)], self.repo.root)
        report = (self.repo.audit / "REPORT.md").read_text()
        self.assertIn("Also raised as: F1-1", report)
        self.assertIn("2 findings raised, 1 merged as duplicates", report)

    def test_same_id_twice_is_rejected(self):
        complete_ledger(self.repo)
        self.repo.write("notes/S1-b.txt", "FIND S1-1 src/util.py:2 low readability: name is vague\nCITE S1-1 src/util.py:2: return x * 2\n")
        code, out = self.repo.check()
        self.assertIn("DUPLICATE ID S1-1", out)

    def test_decision_needs_evidence(self):
        complete_ledger(self.repo)
        self.repo.write("lead2.txt", "DECISION D-1 src/util.py:1: doubling should be tripling\n")
        code, out = self.repo.check()
        self.assertIn("NO EVIDENCE  D-1", out)

    def test_report_refuses_an_incomplete_ledger_unless_forced(self):
        code, out = run(["report", str(self.repo.audit)], self.repo.root)
        self.assertEqual(code, 1)
        code, out = run(["report", "--force", str(self.repo.audit)], self.repo.root)
        self.assertEqual(code, 0, out)
        self.assertIn("Incomplete", (self.repo.audit / "REPORT.md").read_text())

    def test_exclude_pattern_leaves_files_out_with_the_reason(self):
        code, out = self.repo.scope("--exclude", "src/util.py")
        scope = (self.repo.audit / "scope.tsv").read_text()
        self.assertIn("excluded\tsrc/util.py\t0\t0\texcluded with --exclude src/util.py", scope)


class SliceTests(unittest.TestCase):
    def test_a_split_package_is_never_glued_to_another(self):
        files = {f"big/part{i}/f.py": "x = 1\n" * 300 for i in range(3)}
        files["small/a.py"] = "y = 2\n" * 10
        repo = Repo(files)
        try:
            repo.scope("--max-lines", "500")
            rows = [r.split("\t") for r in (repo.audit / "scope.tsv").read_text().splitlines() if r.startswith("S")]
            slices = {}
            for name, path, *_ in rows:
                slices.setdefault(name, set()).add(path.split("/")[0])
            self.assertTrue(all(len(tops) == 1 for tops in slices.values()), slices)
        finally:
            repo.close()


if __name__ == "__main__":
    unittest.main()
