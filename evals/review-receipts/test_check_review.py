#!/usr/bin/env python3
"""Tests for the checker that ships inside the skill. Needs git and Python 3.8 or later.

    python3 evals/review-receipts/test_check_review.py
"""

import os
import subprocess
import sys
import tempfile
import unittest

CHECKER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "skills", "review-receipts", "scripts", "check_review.py")

BASE_CODE = "def a():\n    return 1\n\ndef b():\n    x = 1\n    return x\n"
HEAD_CODE = "def a():\n    return 2\n\ndef b():\n    x = 1\n    return x\n\ndef c(items):\n    for i in items:\n        print(i)\n"
GOOD_FILES = "PASSES 3 agents 0\nFILE m.py: no candidates, reviewed each new line\nFILE gone.py: no candidates, deleted and unused\n"


class CheckerTest(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.git("init", "-q", "-b", "main", "--template=")
        self.write("m.py", BASE_CODE)
        self.write("gone.py", "keep\n")
        self.git("add", "-A")
        self.git("commit", "-qm", "base")
        self.git("checkout", "-qb", "feature")
        os.remove(os.path.join(self.folder.name, "gone.py"))
        self.write("m.py", HEAD_CODE)
        self.write("yarn.lock", "generated\n")
        self.git("add", "-A")
        self.git("commit", "-qm", "change")

    def tearDown(self):
        self.folder.cleanup()

    def write(self, name, text):
        with open(os.path.join(self.folder.name, name), "w", encoding="utf-8") as handle:
            handle.write(text)

    def git(self, *args):
        subprocess.run(
            ["git", "-c", "user.name=T", "-c", "user.email=t@example.com", "-c", "commit.gpgsign=false", *args],
            cwd=self.folder.name, check=True, capture_output=True,
        )

    def check(self, notes, *flags):
        result = subprocess.run(
            [sys.executable, CHECKER, *(flags or ("--base", "main"))],
            cwd=self.folder.name, input=notes, text=True, capture_output=True, check=False,
        )
        return result.returncode, result.stdout

    def assert_fails(self, notes, expected):
        code, output = self.check(notes)
        self.assertEqual(code, 1, output)
        self.assertIn(expected, output)

    def test_clean_notes_pass(self):
        code, output = self.check(GOOD_FILES + "FILE yarn.lock: no candidates, generated\n")
        self.assertEqual(code, 0, output)
        self.assertIn("PASS:", output)

    def test_lock_files_need_no_entry(self):
        code, output = self.check(GOOD_FILES)
        self.assertEqual(code, 0, output)

    def test_valid_finding_passes(self):
        code, output = self.check(GOOD_FILES.replace("0\n", "1\n", 1) + "C1 m.py:2: returns two now\nC1 Confirmed: ran it and got two back\nCITE m.py:2: return 2\n")
        self.assertEqual(code, 0, output)

    def test_missing_passes_line(self):
        self.assert_fails(GOOD_FILES.split("\n", 1)[1], "TOO FEW PASSES")

    def test_too_few_passes(self):
        self.assert_fails(GOOD_FILES.replace("PASSES 3 agents 0", "PASSES 2 agents 0"), "TOO FEW PASSES")

    def test_passes_needs_how_they_ran(self):
        self.assert_fails(GOOD_FILES.replace("PASSES 3 agents 0", "PASSES 3"), "TOO FEW PASSES")

    def test_passes_needs_suspicion_count(self):
        self.assert_fails(GOOD_FILES.replace("PASSES 3 agents 0", "PASSES 3 agents"), "BAD LINE")

    def test_trivial_needs_a_reason(self):
        self.assert_fails(GOOD_FILES.replace("PASSES 3 agents 0", "PASSES 1 trivial"), "NO REASON")

    def test_trivial_with_a_reason_passes(self):
        code, output = self.check(GOOD_FILES.replace("PASSES 3 agents 0", "PASSES 1 trivial: only a README typo fix"))
        self.assertEqual(code, 0, output)

    def test_trimmed_list_fails(self):
        self.assert_fails(GOOD_FILES.replace("agents 0", "agents 30"), "LIST TRIMMED")

    def test_uncovered_file_fails(self):
        self.assert_fails("PASSES 3 agents 0\nFILE m.py: no candidates, reviewed each new line\n", "NOT COVERED  gone.py")

    def test_globs_cover_files(self):
        code, output = self.check("PASSES 3 agents 0\nFILE *.py: no candidates, reviewed each new line\n")
        self.assertEqual(code, 0, output)

    def test_file_needs_a_reason(self):
        self.assert_fails(GOOD_FILES.replace("no candidates, reviewed each new line", "none"), "NO REASON")

    def test_candidate_needs_outcome(self):
        self.assert_fails(GOOD_FILES.replace("0\n", "1\n", 1) + "C1 m.py:2: returns two now\n", "NO OUTCOME")

    def test_outcome_needs_evidence(self):
        self.assert_fails(GOOD_FILES.replace("0\n", "1\n", 1) + "C1 m.py:2: returns two now\nC1 Dropped: fine\n", "NO EVIDENCE")

    def test_outcome_needs_candidate(self):
        self.assert_fails(GOOD_FILES + "C1 Dropped: disproved by reading line 4\n", "NO CANDIDATE")

    def test_kept_finding_needs_citation(self):
        self.assert_fails(GOOD_FILES.replace("0\n", "1\n", 1) + "C1 m.py:2: returns two now\nC1 Likely: traced it through the caller\n", "NO CITATION")

    def test_preexisting_needs_no_citation(self):
        code, output = self.check(GOOD_FILES.replace("0\n", "1\n", 1) + "C1 m.py:6: returns x\nC1 Preexisting: this was already wrong on main\n")
        self.assertEqual(code, 0, output)

    def test_invented_code_fails(self):
        self.assert_fails(GOOD_FILES.replace("0\n", "1\n", 1) + "C1 m.py:2: bad\nC1 Confirmed: ran it and it broke\nCITE m.py:2: return 99\n", "NOT FOUND")

    def test_invented_file_fails(self):
        self.assert_fails(GOOD_FILES.replace("0\n", "1\n", 1) + "C1 nope.py:1: bad\nC1 Confirmed: ran it and it broke\nCITE nope.py:1: x\n", "no such file")

    def test_wrong_line_fails(self):
        self.assert_fails(GOOD_FILES.replace("0\n", "1\n", 1) + "C1 m.py:1: bad\nC1 Confirmed: ran it and it broke\nCITE m.py:1: for i in items:\n", "WRONG LINE")

    def test_empty_quote_fails(self):
        self.assert_fails(GOOD_FILES.replace("0\n", "1\n", 1) + "C1 m.py:2: bad\nC1 Confirmed: ran it and it broke\nCITE m.py:2:\n", "no quote given")

    def test_nearby_line_is_tolerated(self):
        code, output = self.check(GOOD_FILES.replace("0\n", "1\n", 1) + "C1 m.py:10: bad\nC1 Confirmed: ran it and it broke\nCITE m.py:9: for i in items:\n")
        self.assertEqual(code, 0, output)

    def test_quote_across_lines(self):
        code, output = self.check(GOOD_FILES.replace("0\n", "1\n", 1) + "C1 m.py:9: bad\nC1 Confirmed: ran it and it broke\nCITE m.py:9: for i in items: print(i)\n")
        self.assertEqual(code, 0, output)

    def test_removed_line_found_in_base(self):
        code, output = self.check(GOOD_FILES.replace("0\n", "1\n", 1) + "C1 m.py:2: was removed\nC1 Confirmed: compared with the base version\nCITE m.py:2: return 1\n")
        self.assertEqual(code, 0, output)

    def test_deleted_file_found_in_base(self):
        code, output = self.check(GOOD_FILES.replace("0\n", "1\n", 1) + "C1 gone.py:1: removed\nC1 Likely: nothing else provides this\nCITE gone.py:1: keep\n")
        self.assertEqual(code, 0, output)

    def test_unchanged_line_is_a_warning_only(self):
        code, output = self.check(GOOD_FILES.replace("0\n", "1\n", 1) + "C1 m.py:6: stale\nC1 Likely: traced it through the caller\nCITE m.py:6: return x\n")
        self.assertEqual(code, 0, output)
        self.assertIn("OUTSIDE DIFF", output)

    def test_junk_line_fails(self):
        self.assert_fails(GOOD_FILES + "some stray line\n", "BAD LINE")

    def test_without_base_coverage_is_skipped(self):
        code, output = self.check("PASSES 3 agents 0\n", "--help")
        self.assertEqual(code, 0, output)
        result = subprocess.run([sys.executable, CHECKER], cwd=self.folder.name, input="PASSES 3 agents 0\n", text=True, capture_output=True, check=False)
        self.assertEqual(result.returncode, 0, result.stdout)


if __name__ == "__main__":
    unittest.main()
