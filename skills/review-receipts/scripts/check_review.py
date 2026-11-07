#!/usr/bin/env python3
"""Check a review's working notes against the code before the report is written.

Reads notes from stdin, one item per line:

    PASSES 3 agents 2
    FILE src/orders.py: C1 C2
    FILE src/old_name/*: no candidates, only renames an import
    C1 src/orders.py:42: total can be null here
    C1 Confirmed: ran it and got a TypeError
    CITE src/orders.py:42: total = order.total + fee
    C2 src/orders.py:80: retry may double charge
    C2 Dropped: the gateway call passes an idempotency key at line 77

It fails if the hunting passes didn't run, a changed file isn't accounted for, a candidate has no outcome, a kept finding
has no citation, or a citation doesn't match the code. Uses only the standard library.

    python3 check_review.py --base main < notes
"""

import argparse
import fnmatch
import re
import subprocess
import sys

# A quote can sit a little away from the cited line after edits, which is still a valid
# citation. Further away is reported as a wrong line.
LINE_TOLERANCE = 2

# Longest quote worth matching across lines. Findings quote a few lines, not whole functions.
MAX_QUOTE_LINES = 30

# Independent passes catch different bugs, and three catch far more than one or two.
REQUIRED_PASSES = 3

# A reason for skipping a file has to say something, so "none" alone isn't accepted.
MIN_REASON_CHARS = 12

# Three passes often report the same bug, but merging them shouldn't remove most of the list.
# In testing, true duplicates took a list down to a little over half its length.
MIN_LIST_KEPT = 0.4

OUTCOMES = {"Confirmed", "Likely", "Question", "Preexisting", "Dropped"}
NEEDS_CITATION = {"Confirmed", "Likely"}

# Files nobody reviews line by line. Their change is still expected to be noticed in the diff.
SKIPPED_FILES = re.compile(
    r"(^|/)(vendor|vendored|third_party|node_modules|dist|build|__snapshots__)/"
    r"|\.(lock|min\.js|min\.css|map|snap|svg|png|jpe?g|gif|ico|pdf|woff2?|ttf)$"
    r"|(^|/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|go\.sum|Cargo\.lock|poetry\.lock|Gemfile\.lock|composer\.lock)$"
    r"|\.(pb|generated|gen)\.\w+$"
)

PASSES_LINE = re.compile(r"^PASSES\s+(?P<count>\d+)\s*(?P<how>agents|solo|trivial)?\b:?\s*(?P<reason>.*)$")
SUSPECT_COUNT = re.compile(r"^\d+$")
FILE_LINE = re.compile(r"^FILE\s+(?P<path>.+?):\s*(?P<rest>.*)$")
CANDIDATE_LINE = re.compile(r"^(?P<id>C\d+)\s+(?P<path>[^\s:]+):(?P<line>\d+)(?:-\d+)?:\s*(?P<text>.*)$")
OUTCOME_LINE = re.compile(r"^(?P<id>C\d+)\s+(?P<outcome>[A-Z][a-z]+):?\s*(?P<text>.*)$")
CITE_LINE = re.compile(r"^CITE\s+(?P<path>[^\s:]+):(?P<line>\d+)(?:-\d+)?:\s?(?P<quote>.*)$")
HUNK = re.compile(r"^@@ -\S+ \+(\d+)(?:,(\d+))? @@")


def normalize(text):
    return " ".join(text.split())


def git(*args):
    result = subprocess.run(["git", *args], capture_output=True, text=True, errors="replace", check=False)
    return result.stdout if result.returncode == 0 else None


def changed_files(base):
    """Files changed since the base, whether committed, staged, unstaged, or untracked."""
    names = set()
    for args in (("diff", "--name-only", f"{base}..."), ("diff", "--name-only"), ("diff", "--name-only", "--cached"), ("ls-files", "--others", "--exclude-standard")):
        output = git(*args)
        if output:
            names.update(output.splitlines())
    return {name for name in names if not SKIPPED_FILES.search(name)}


def read_lines(path, base):
    try:
        with open(path, encoding="utf-8", errors="replace") as handle:
            return handle.read().splitlines(), "current"
    except OSError:
        pass
    if base:
        content = git("show", f"{base}:{path}")
        if content is not None:
            return content.splitlines(), "base"
    return None, None


def changed_lines(path, base):
    """Line numbers this change added or modified in the current version of the file."""
    diff = git("diff", "-U0", f"{base}...", "--", path)
    if diff is None:
        diff = git("diff", "-U0", base, "--", path)
    if diff is None:
        return None
    changed = set()
    for row in diff.splitlines():
        match = HUNK.match(row)
        if match:
            start = int(match.group(1))
            changed.update(range(start, start + int(match.group(2) or 1)))
    return changed


def find_quote(lines, quote):
    """All (first, last) 1-indexed line spans holding the quote, which may cover several lines."""
    target = normalize(quote)
    single = [(i + 1, i + 1) for i, text in enumerate(lines) if target in normalize(text)]
    if single:
        return single

    spans = []
    for start in range(len(lines)):
        text = normalize(lines[start])
        for end in range(start + 1, min(start + MAX_QUOTE_LINES, len(lines))):
            text = normalize(f"{text} {lines[end]}")
            if target in text:
                # Keep the span only if the quote really needs its first line.
                if target not in normalize(" ".join(lines[start + 1 : end + 1])):
                    spans.append((start + 1, end + 1))
                break
    return spans


def check_citation(path, line, quote, base):
    """Returns (status, detail). NOT FOUND and WRONG LINE fail the check. OUTSIDE DIFF is a warning."""
    if not quote.strip():
        return "NOT FOUND", "no quote given, so this citation can't be checked"
    lines, version = read_lines(path, base)
    if lines is None:
        return "NOT FOUND", "no such file"

    spans = find_quote(lines, quote)
    if not spans and version == "current" and base:
        removed = git("show", f"{base}:{path}")
        if removed is not None and find_quote(removed.splitlines(), quote):
            return "OK", "a removed line, found in the base version"
    if not spans:
        return "NOT FOUND", "that text isn't in the file"

    def distance(span):
        return 0 if span[0] <= line <= span[1] else min(abs(span[0] - line), abs(span[1] - line))

    first, last = min(spans, key=distance)
    if distance((first, last)) > LINE_TOLERANCE:
        return "WRONG LINE", f"the quote is at line {first}, not {line}"

    if base and version == "current":
        changed = changed_lines(path, base)
        if changed is not None and not changed.intersection(range(first, last + 1)):
            return "OUTSIDE DIFF", f"line {first} isn't changed here, so the finding must explain how this change makes it matter, or it's pre-existing"
    return "OK", f"line {first}"


def main():
    parser = argparse.ArgumentParser(description="Check review notes against the code.")
    parser.add_argument("--base", help="base ref. Without it, files aren't checked for coverage")
    args = parser.parse_args()

    problems = []
    warnings = []
    covered = []
    candidates = {}
    outcomes = {}
    cited = set()
    current = None
    passes = None

    for number, raw in enumerate(sys.stdin, 1):
        row = raw.strip()
        if not row:
            continue

        if match := PASSES_LINE.match(row):
            passes = match
        elif match := FILE_LINE.match(row):
            rest = match["rest"].strip()
            if not re.search(r"\bC\d+\b", rest) and len(rest) < MIN_REASON_CHARS:
                problems.append(f"NO REASON    {match['path']}: list its candidates, or say why it has none")
            covered.append(match["path"])
        elif match := CITE_LINE.match(row):
            status, detail = check_citation(match["path"], int(match["line"]), match["quote"], args.base)
            if current:
                cited.add(current)
            if status in ("NOT FOUND", "WRONG LINE"):
                problems.append(f"{status:<12} {match['path']}:{match['line']}: {detail}")
            elif status == "OUTSIDE DIFF":
                warnings.append(f"{status:<12} {match['path']}:{match['line']}: {detail}")
        elif match := CANDIDATE_LINE.match(row):
            candidates[match["id"]] = row
            current = match["id"]
        elif (match := OUTCOME_LINE.match(row)) and match["outcome"] in OUTCOMES:
            outcomes[match["id"]] = match["outcome"]
            current = match["id"]
            if len(match["text"].strip()) < MIN_REASON_CHARS:
                problems.append(f"NO EVIDENCE  {match['id']}: say what supports {match['outcome']}")
        else:
            problems.append(f"BAD LINE     line {number}: {row[:80]}")

    if passes is None:
        problems.append("TOO FEW PASSES no PASSES line: run the hunt in step 2, then add PASSES 3 agents, PASSES 3 solo, or PASSES 1 trivial: <why>")
    elif passes["how"] == "trivial":
        if len(passes["reason"].strip()) < MIN_REASON_CHARS:
            problems.append("NO REASON    PASSES 1 trivial: say why this change is trivial")
    elif int(passes["count"]) < REQUIRED_PASSES or passes["how"] is None:
        problems.append(f"TOO FEW PASSES {passes['count']}: run all {REQUIRED_PASSES} passes in step 2, and say agents or solo")
    elif not SUSPECT_COUNT.match(passes["reason"].strip()):
        problems.append("BAD LINE     PASSES: end it with the total suspicions the passes returned, such as PASSES 3 agents 24")
    elif len(candidates) < MIN_LIST_KEPT * int(passes["reason"]):
        problems.append(f"LIST TRIMMED {len(candidates)} candidates from {passes['reason']} suspicions: restore what was dropped in the merge and verify it")

    if args.base:
        for path in sorted(changed_files(args.base)):
            if not any(fnmatch.fnmatch(path, pattern) for pattern in covered):
                problems.append(f"NOT COVERED  {path}: read this changed file, then add a FILE line for it")

    for candidate in sorted(candidates, key=lambda c: int(c[1:])):
        outcome = outcomes.get(candidate)
        if outcome is None:
            problems.append(f"NO OUTCOME   {candidate}: give it Confirmed, Likely, Question, Preexisting, or Dropped")
        elif outcome in NEEDS_CITATION and candidate not in cited:
            problems.append(f"NO CITATION  {candidate}: add a CITE line with the exact code")
    for candidate in sorted(set(outcomes) - set(candidates), key=lambda c: int(c[1:])):
        problems.append(f"NO CANDIDATE {candidate}: it has an outcome but no line stating the suspicion")

    for row in problems + warnings:
        print(row)
    kept = sum(1 for outcome in outcomes.values() if outcome in NEEDS_CITATION)
    print(f"{'FAIL' if problems else 'PASS'}: {len(covered)} file entries, {len(candidates)} candidates, {kept} kept, {len(problems)} problems, {len(warnings)} warnings")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
