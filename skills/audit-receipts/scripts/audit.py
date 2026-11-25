#!/usr/bin/env python3
"""Scope a codebase audit, check its ledger against the code, and write its report.

    python3 audit.py scope  --out <dir> [--max-lines 4000] [--months 12] [path ...]
    python3 audit.py spots  <dir>
    python3 audit.py check  <dir>
    python3 audit.py report <dir>

`scope` lists every tracked text file to audit, splits them into slices, marks hotspots
from git history, and pins the commit. `check` reads every `*.txt` under the audit folder
(the agents' returns, saved as they came back, plus the lead's own lines) and fails until
the ledger is complete: every file has a note, every finding has a quote that matches the
code, a verdict from a verifier, and proof if it's at the bar. `report` writes REPORT.md
from the ledger, so nothing is dropped between the agents and the report.

Uses only the standard library.
"""

import argparse
import fnmatch
import hashlib
import math
import re
import subprocess
import sys
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

# A slice is what one reviewer reads in full. Long contexts lose detail in the middle,
# so slices stay small enough to read whole.
DEFAULT_MAX_LINES = 4000

# Files nobody reviews line by line. They're listed in scope as excluded, with the reason.
SKIPPED = re.compile(
    r"(^|/)(vendor|vendored|third_party|node_modules|dist|build|out|coverage|__snapshots__|\.yarn)/"
    r"|\.(lock|min\.js|min\.css|map|snap|svg|png|jpe?g|gif|webp|ico|pdf|woff2?|ttf|otf|eot|mp4|mp3|zip|gz|tgz|jar|wasm)$"
    r"|(^|/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|go\.sum|Cargo\.lock|poetry\.lock|uv\.lock|Gemfile\.lock|composer\.lock|Pipfile\.lock)$"
    r"|\.(pb|generated|gen)\.\w+$|(^|/)[^/]*\.gen\.\w+$"
)

SEVERITIES = ["bar", "high", "medium", "low", "nit"]
VERDICTS = {"Confirmed", "Likely", "Overstated", "Refuted", "Unverified"}
KEPT = {"Confirmed", "Likely", "Overstated", "Unverified"}

# A note or reason has to say something specific, so "ok" or "fine" isn't accepted.
MIN_NOTE_CHARS = 20
MIN_REASON_CHARS = 12

# Quotes can drift a line or two from the cited line; further is a wrong citation.
LINE_TOLERANCE = 2
MAX_QUOTE_LINES = 30

# Share of each slice's files whose notes a verifier checks against the file.
SPOT_SHARE = 0.05
MIN_SPOTS = 2

# Hotspots: files changed most often, weighted by size, get the extra passes.
HOTSPOT_SHARE = 0.1

ID = r"[A-Z][A-Z0-9]*-\d+"
LOC = r"(?P<path>[^\s:]+):(?P<line>\d+)(?:-(?P<end>\d+))?"
PATTERNS = {
    "FILE": re.compile(r"^FILE\s+(?P<path>\S+?):\s*(?P<note>.*)$"),
    "FIND": re.compile(rf"^FIND\s+(?P<id>{ID})\s+{LOC}\s+(?P<sev>[a-z]+)\s+(?P<cat>[a-z0-9-]+):\s*(?P<claim>.+)$"),
    "CITE": re.compile(rf"^CITE\s+(?P<id>{ID})\s+{LOC}:\s?(?P<quote>.*)$"),
    "FIX": re.compile(rf"^FIX\s+(?P<id>{ID}):\s*(?P<text>.+)$"),
    "VERDICT": re.compile(rf"^VERDICT\s+(?P<id>{ID})\s+(?P<verdict>[A-Z][a-z]+):?\s*(?P<text>.*)$"),
    "SEVERITY": re.compile(rf"^SEVERITY\s+(?P<id>{ID})\s+(?P<sev>[a-z]+):?\s*(?P<text>.*)$"),
    "REFUTE": re.compile(rf"^REFUTE\s+(?P<id>{ID})\s+{LOC}:\s?(?P<quote>.*)$"),
    "PROOF": re.compile(rf"^PROOF\s+(?P<id>{ID}):\s*(?P<text>.+)$"),
    "DUP": re.compile(rf"^DUP\s+(?P<id>{ID})\s+(?:of\s+)?(?P<of>{ID})\b"),
    "ROUTE": re.compile(rf"^ROUTE\s+(?P<id>{ID}):?\s*(?P<text>.+)$"),
    "SPOT": re.compile(r"^SPOT\s+(?P<path>\S+?):\s*(?P<result>accurate|wrong)\b:?\s*(?P<text>.*)$"),
    "SCORE": re.compile(r"^SCORE\s+(?P<area>.+?)\s+(?P<score>\d+(?:\.5)?)/10:\s*(?P<text>.+)$"),
    "DECISION": re.compile(rf"^DECISION\s+(?P<id>{ID})\s+{LOC}:\s*(?P<text>.+)$"),
    "TOOL": re.compile(r"^TOOL\s+(?P<name>[^:]+):\s*(?P<text>.+)$"),
    "GAP": re.compile(r"^GAP:?\s*(?P<text>.+)$"),
    "SUMMARY": re.compile(r"^SUMMARY:?\s*(?P<text>.+)$"),
}


def git(*args, cwd=None):
    result = subprocess.run(["git", *args], capture_output=True, text=True, errors="replace", check=False, cwd=cwd)
    return result.stdout if result.returncode == 0 else None


def normalize(text):
    return " ".join(text.split())


def is_text(path):
    try:
        with open(path, "rb") as handle:
            return b"\0" not in handle.read(8192)
    except OSError:
        return False


def line_count(path):
    with open(path, encoding="utf-8", errors="replace") as handle:
        return sum(1 for _ in handle)


# ---------------------------------------------------------------- scope


def slice_files(files, max_lines):
    """Groups files into slices of about max_lines, keeping folders together where they fit."""
    tree = defaultdict(list)
    for path, lines in files:
        tree[str(Path(path).parent)].append((path, lines))

    def under(folder):
        prefix = "" if folder == "." else folder + "/"
        return [(p, n) for p, n in files if folder == "." or p.startswith(prefix)]

    def split(folder):
        members = under(folder)
        if not members:
            return []
        if sum(n for _, n in members) <= max_lines:
            return [members]
        prefix = "" if folder == "." else folder + "/"
        children = sorted({p[len(prefix):].split("/")[0] for p, _ in members if "/" in p[len(prefix):]})
        # A unit is a child folder's slices; it can share a slice with its neighbours only if it fits whole,
        # so one reviewer never gets half of one package glued to another.
        units = [split(prefix + child) for child in children]
        chunk, size = [], 0
        for path, lines in sorted(tree.get(folder, [])):
            if chunk and size + lines > max_lines:
                units.append([chunk])
                chunk, size = [], 0
            chunk.append((path, lines))
            size += lines
        if chunk:
            units.append([chunk])
        packed = [piece for unit in units if len(unit) != 1 for piece in unit]
        current, size = [], 0
        for unit in (u for u in units if len(u) == 1):
            unit_size = sum(n for _, n in unit[0])
            if current and size + unit_size > max_lines:
                packed.append(current)
                current, size = [], 0
            current = current + unit[0]
            size += unit_size
        if current:
            packed.append(current)
        return packed

    return split(".")


def churn(months, cwd):
    output = git("log", f"--since={months}.months", "--format=", "--name-only", cwd=cwd) or ""
    return Counter(row for row in output.splitlines() if row)


def scope(args):
    root = Path(git("rev-parse", "--show-toplevel").strip())
    commit = git("rev-parse", "HEAD", cwd=root).strip()
    dirty = bool((git("status", "--porcelain", cwd=root) or "").strip())
    listed = (git("ls-files", "--", *(args.paths or ["."]), cwd=root) or "").splitlines()

    included, excluded = [], []
    for path in listed:
        full = root / path
        if not full.is_file():
            continue
        pattern = next((p for p in args.exclude if fnmatch.fnmatch(path, p)), None)
        if pattern:
            excluded.append((path, f"excluded with --exclude {pattern}"))
        elif SKIPPED.search(path):
            excluded.append((path, "generated, vendored, lock or binary by name"))
        elif not is_text(full):
            excluded.append((path, "binary"))
        else:
            included.append((path, line_count(full)))

    changes = churn(args.months, root)
    ranked = sorted(included, key=lambda f: changes[f[0]] * math.log2(f[1] + 2), reverse=True)
    hot_count = max(1, round(len(included) * HOTSPOT_SHARE)) if included else 0
    hot = {p for p, _ in ranked[:hot_count] if changes[p] > 0}

    slices = slice_files(sorted(included), args.max_lines)
    out = Path(args.out)
    (out / "notes").mkdir(parents=True, exist_ok=True)
    with open(out / "scope.tsv", "w", encoding="utf-8") as handle:
        handle.write(f"# commit {commit}\n# date {date.today().isoformat()}\n")
        if dirty:
            handle.write("# warning: the working tree had uncommitted changes when scoped\n")
        handle.write("slice\tpath\tlines\tchanges\thot\n")
        for number, members in enumerate(slices, 1):
            for path, lines in members:
                handle.write(f"S{number}\t{path}\t{lines}\t{changes[path]}\t{'hot' if path in hot else ''}\n")
        for path, reason in excluded:
            handle.write(f"excluded\t{path}\t0\t0\t{reason}\n")

    total = sum(n for _, n in included)
    print(f"commit {commit[:12]}{' (uncommitted changes present)' if dirty else ''}")
    print(f"{len(included)} files, {total} lines, in {len(slices)} slices; {len(excluded)} excluded; {len(hot)} hotspots")
    for number, members in enumerate(slices, 1):
        folders = sorted({str(Path(p).parent) for p, _ in members})
        shown = ", ".join(folders[:4]) + (f" and {len(folders) - 4} more" if len(folders) > 4 else "")
        print(f"  S{number}: {len(members)} files, {sum(n for _, n in members)} lines: {shown}")
    print(f"wrote {out / 'scope.tsv'}")
    return 0


# ---------------------------------------------------------------- ledger


def read_scope(folder):
    commit, rows = None, []
    with open(folder / "scope.tsv", encoding="utf-8") as handle:
        for raw in handle:
            row = raw.rstrip("\n")
            if row.startswith("# commit "):
                commit = row.split()[2]
            elif row and not row.startswith("#") and not row.startswith("slice\t"):
                cells = row.split("\t")
                rows.append({"slice": cells[0], "path": cells[1], "lines": int(cells[2]), "changes": int(cells[3]), "note": cells[4] if len(cells) > 4 else ""})
    return commit, rows


def read_ledger(folder):
    entries, bad = [], []
    for file in sorted(folder.rglob("*.txt")):
        for number, raw in enumerate(file.read_text(encoding="utf-8", errors="replace").splitlines(), 1):
            row = raw.strip().lstrip("-* ").strip("`").strip()
            if not row or row.startswith("#"):
                continue
            kind = row.split(maxsplit=1)[0].rstrip(":")
            pattern = PATTERNS.get(kind)
            if pattern is None:
                continue  # prose around the lines is allowed
            match = pattern.match(row)
            if match:
                entries.append((kind, match, f"{file.relative_to(folder)}:{number}"))
            else:
                bad.append(f"BAD LINE     {file.relative_to(folder)}:{number}: {row[:90]}")
    return entries, bad


class Source:
    """Reads files as they were at the scoped commit, so later edits don't break citations."""

    def __init__(self, commit):
        self.commit = commit
        self.root = Path(git("rev-parse", "--show-toplevel").strip())
        self.cache = {}

    def lines(self, path):
        if path not in self.cache:
            text = git("show", f"{self.commit}:{path}", cwd=self.root) if self.commit else None
            if text is None and (self.root / path).is_file():
                text = (self.root / path).read_text(encoding="utf-8", errors="replace")
            self.cache[path] = text.splitlines() if text is not None else None
        return self.cache[path]


def find_quote(lines, quote):
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
                if target not in normalize(" ".join(lines[start + 1 : end + 1])):
                    spans.append((start + 1, end + 1))
                break
    return spans


def check_quote(source, path, line, quote):
    if len(normalize(quote)) < 4:
        return "no quote given, so it can't be checked"
    lines = source.lines(path)
    if lines is None:
        return "no such file at the scoped commit"
    spans = find_quote(lines, quote)
    if not spans:
        return "that text isn't in the file"

    def distance(span):
        return 0 if span[0] <= line <= span[1] else min(abs(span[0] - line), abs(span[1] - line))

    nearest = min(spans, key=distance)
    if distance(nearest) > LINE_TOLERANCE:
        return f"the quote is at line {nearest[0]}, not {line}"
    return None


def spot_sample(commit, rows):
    """The files whose notes a verifier must check, chosen from the commit so they can't be guessed."""
    by_slice = defaultdict(list)
    for row in rows:
        if row["slice"] != "excluded":
            by_slice[row["slice"]].append(row["path"])
    chosen = set()
    for paths in by_slice.values():
        count = min(len(paths), max(MIN_SPOTS, math.ceil(len(paths) * SPOT_SHARE)))
        ranked = sorted(paths, key=lambda p: hashlib.sha256(f"{commit}:{p}".encode()).hexdigest())
        chosen.update(ranked[:count])
    return chosen


def build(folder):
    commit, rows = read_scope(folder)
    entries, problems = read_ledger(folder)
    source = Source(commit)
    ledger = {
        "commit": commit,
        "rows": rows,
        "notes": {},
        "finds": {},
        "cites": defaultdict(list),
        "fixes": {},
        "verdicts": {},
        "severity": {},
        "refutes": defaultdict(list),
        "proofs": defaultdict(list),
        "dups": {},
        "routes": {},
        "spots": {},
        "scores": [],
        "decisions": {},
        "tools": [],
        "gaps": [],
        "summary": None,
    }
    for kind, m, where in entries:
        if kind == "FILE":
            ledger["notes"].setdefault(m["path"], []).append((m["note"].strip(), where))
        elif kind == "FIND":
            if m["id"] in ledger["finds"]:
                problems.append(f"DUPLICATE ID {m['id']}: raised at {ledger['finds'][m['id']]['where']} and {where}; give each finding its own ID")
                continue
            ledger["finds"][m["id"]] = {"path": m["path"], "line": int(m["line"]), "sev": m["sev"], "cat": m["cat"], "claim": m["claim"].strip(), "where": where}
        elif kind == "CITE":
            ledger["cites"][m["id"]].append((m["path"], int(m["line"]), m["quote"], where))
        elif kind == "FIX":
            ledger["fixes"][m["id"]] = m["text"].strip()
        elif kind == "VERDICT":
            ledger["verdicts"][m["id"]] = (m["verdict"], m["text"].strip(), where)
        elif kind == "SEVERITY":
            ledger["severity"][m["id"]] = (m["sev"], m["text"].strip(), where)
        elif kind == "REFUTE":
            ledger["refutes"][m["id"]].append((m["path"], int(m["line"]), m["quote"], where))
        elif kind == "PROOF":
            ledger["proofs"][m["id"]].append(m["text"].strip())
        elif kind == "DUP":
            ledger["dups"][m["id"]] = m["of"]
        elif kind == "ROUTE":
            ledger["routes"][m["id"]] = m["text"].strip()
        elif kind == "SPOT":
            ledger["spots"][m["path"]] = (m["result"], m["text"].strip())
        elif kind == "SCORE":
            ledger["scores"].append((m["area"].strip(), float(m["score"]), m["text"].strip(), where))
        elif kind == "DECISION":
            ledger["decisions"][m["id"]] = (m["path"], int(m["line"]), m["text"].strip())
        elif kind == "TOOL":
            ledger["tools"].append((m["name"].strip(), m["text"].strip()))
        elif kind == "GAP":
            ledger["gaps"].append(m["text"].strip())
        elif kind == "SUMMARY":
            ledger["summary"] = m["text"].strip()
    return ledger, problems, source


def final_severity(ledger, fid):
    if fid in ledger["severity"]:
        return ledger["severity"][fid][0]
    return ledger["finds"][fid]["sev"]


def primary(ledger, fid):
    seen = set()
    while fid in ledger["dups"] and fid not in seen:
        seen.add(fid)
        fid = ledger["dups"][fid]
    return fid


def validate(ledger, problems, source):
    rows = [r for r in ledger["rows"] if r["slice"] != "excluded"]
    notes = ledger["notes"]
    finds = ledger["finds"]

    # Coverage: every file in scope has a note that says something about it.
    for row in rows:
        entries = notes.get(row["path"])
        if not entries:
            problems.append(f"NOT COVERED  {row['slice']} {row['path']}: no FILE note; have it read and noted")
        elif all(len(note) < MIN_NOTE_CHARS for note, _ in entries):
            problems.append(f"THIN NOTE    {row['path']}: say what the file does and what was checked")
    in_scope = {r["path"] for r in ledger["rows"]}
    for path in sorted(set(notes) - in_scope):
        problems.append(f"NOT IN SCOPE {path}: a FILE note for a file scope doesn't list; check the path")

    # Spot checks: a verifier compared these notes with the files.
    for path in sorted(spot_sample(ledger["commit"], ledger["rows"])):
        result = ledger["spots"].get(path)
        if result is None:
            problems.append(f"NEED SPOT    {path}: have a verifier compare its FILE note with the file, then add SPOT")
        elif result[0] == "wrong":
            problems.append(f"SPOT WRONG   {path}: its note doesn't match the file; review that slice again, then mark the spot accurate")

    # Findings: shape, quotes, verdicts, proof.
    for fid, find in sorted(finds.items()):
        if find["sev"] not in SEVERITIES:
            problems.append(f"BAD SEVERITY {fid}: use one of {', '.join(SEVERITIES)}")
        if find["path"] not in in_scope and source.lines(find["path"]) is None:
            problems.append(f"NO SUCH FILE {fid}: {find['path']}")
        if fid in ledger["dups"]:
            target = ledger["dups"][fid]
            if target not in finds:
                problems.append(f"BAD DUP      {fid}: marked a duplicate of {target}, which doesn't exist")
            elif primary(ledger, fid) == fid:
                problems.append(f"BAD DUP      {fid}: duplicates form a loop")
            continue
        cites = ledger["cites"].get(fid, [])
        if not cites:
            problems.append(f"NO CITATION  {fid}: add a CITE line with the exact code")
        for path, line, quote, where in cites:
            if error := check_quote(source, path, line, quote):
                problems.append(f"BAD CITE     {fid} {path}:{line}: {error} ({where})")
        verdict = ledger["verdicts"].get(fid)
        if verdict is None:
            problems.append(f"NO VERDICT   {fid}: a verifier must give Confirmed, Likely, Overstated, Refuted or Unverified")
            continue
        name, text, _ = verdict
        if name not in VERDICTS:
            problems.append(f"BAD VERDICT  {fid}: {name} isn't one of {', '.join(sorted(VERDICTS))}")
            continue
        if len(text) < MIN_REASON_CHARS:
            problems.append(f"NO EVIDENCE  {fid}: say what supports {name}")
        if name == "Refuted":
            refutes = ledger["refutes"].get(fid, [])
            if not refutes:
                problems.append(f"NO DISPROOF  {fid}: Refuted needs a REFUTE line quoting the code that disproves it; a judgment that it doesn't matter lowers its severity instead")
            for path, line, quote, where in refutes:
                if error := check_quote(source, path, line, quote):
                    problems.append(f"BAD REFUTE   {fid} {path}:{line}: {error} ({where})")
        if name == "Overstated":
            new = ledger["severity"].get(fid)
            if new is None:
                problems.append(f"NO SEVERITY  {fid}: Overstated needs a SEVERITY line with the lower severity")
            elif new[0] in SEVERITIES and find["sev"] in SEVERITIES and SEVERITIES.index(new[0]) <= SEVERITIES.index(find["sev"]):
                problems.append(f"NOT LOWER    {fid}: Overstated must lower the severity, from {find['sev']}")
        if name in KEPT and final_severity(ledger, fid) == "bar":
            if name != "Confirmed" or not ledger["proofs"].get(fid):
                problems.append(f"BAR UNPROVEN {fid}: a release-bar finding needs Confirmed and a PROOF line (a failing test, a command, or quoted library source), or a lower severity")

    for fid in sorted(set(ledger["verdicts"]) - set(finds)):
        problems.append(f"NO FINDING   {fid}: has a verdict but no FIND line")

    # Scores point at real findings, so every point lost has a reason.
    for area, score, text, where in ledger["scores"]:
        ids = set(re.findall(ID, text))
        if score > 10:
            problems.append(f"BAD SCORE    {area}: over 10 ({where})")
        if score < 10 and not ids:
            problems.append(f"SCORE REASON {area}: name the finding IDs behind each point lost ({where})")
        for fid in sorted(ids):
            if fid not in finds:
                problems.append(f"SCORE REASON {area}: {fid} isn't a finding ({where})")
            elif ledger["verdicts"].get(primary(ledger, fid), ("",))[0] == "Refuted":
                problems.append(f"SCORE REASON {area}: {fid} was refuted, so it can't cost points ({where})")
    for did, (path, line, text) in ledger["decisions"].items():
        if source.lines(path) is None:
            problems.append(f"BAD DECISION {did}: {path} isn't in the repo")
        if "evidence" not in text.lower():
            problems.append(f"NO EVIDENCE  {did}: a questioned decision says what evidence shows it's wrong or costly")
    if not ledger["summary"]:
        problems.append("NO SUMMARY   add a SUMMARY line: the overall verdict in one sentence")
    if not ledger["scores"]:
        problems.append("NO SCORES    add SCORE lines for each area")
    return problems


def check(args):
    folder = Path(args.dir)
    ledger, problems, source = build(folder)
    problems = validate(ledger, problems, source)
    for row in problems:
        print(row)
    finds = ledger["finds"]
    verdicts = Counter(ledger["verdicts"][f][0] for f in finds if f in ledger["verdicts"] and f not in ledger["dups"])
    files = sum(1 for r in ledger["rows"] if r["slice"] != "excluded")
    noted = sum(1 for r in ledger["rows"] if r["slice"] != "excluded" and r["path"] in ledger["notes"])
    print(
        f"{'FAIL' if problems else 'PASS'}: {noted}/{files} files noted, {len(finds)} findings "
        f"({len(ledger['dups'])} duplicates; " + ", ".join(f"{v} {k}" for k, v in sorted(verdicts.items())) + f"), {len(problems)} problems"
    )
    return 1 if problems else 0


# ---------------------------------------------------------------- report


def report(args):
    folder = Path(args.dir)
    ledger, problems, source = build(folder)
    problems = validate(ledger, problems, source)
    if problems and not args.force:
        print(f"FAIL: {len(problems)} problems; run check and fix them first, or pass --force to write a report marked incomplete")
        return 1
    finds, out = ledger["finds"], []
    rows = [r for r in ledger["rows"] if r["slice"] != "excluded"]
    excluded = [r for r in ledger["rows"] if r["slice"] == "excluded"]
    duplicates = defaultdict(list)
    for fid in ledger["dups"]:
        duplicates[primary(ledger, fid)].append(fid)
    primaries = [f for f in finds if f not in ledger["dups"]]

    def verdict(fid):
        return ledger["verdicts"].get(fid, ("Unverified", "", ""))[0]

    out.append(f"# Audit at `{(ledger['commit'] or 'unknown')[:12]}`\n")
    if problems:
        out.append(f"> **Incomplete:** the ledger check still reports {len(problems)} problems, listed at the end.\n")
    out.append(f"**{ledger['summary'] or 'No summary written.'}**\n")

    if ledger["scores"]:
        out.append("## Scores\n\n| Area | Score | Why it isn't 10 |\n| --- | --- | --- |")
        for area, score, text, _ in ledger["scores"]:
            shown = int(score) if score.is_integer() else score
            out.append(f"| {area} | {shown}/10 | {text.replace('|', '/')} |")
        out.append("")

    def entry(fid):
        find = finds[fid]
        name, text, _ = ledger["verdicts"].get(fid, ("Unverified", "no verdict", ""))
        sev = final_severity(ledger, fid)
        was = f", lowered from {find['sev']}" if sev != find["sev"] else ""
        lines = [f"### {fid}: {find['claim']}", f"`{find['path']}:{find['line']}` · {find['cat']} · {name}{was}", ""]
        for path, line, quote, _ in ledger["cites"].get(fid, [])[:3]:
            lines.append(f"- Code: `{path}:{line}` `{quote.strip()}`")
        lines.append(f"- Verifier: {text}")
        for proof in ledger["proofs"].get(fid, []):
            lines.append(f"- Proof: {proof}")
        if fid in ledger["severity"] and ledger["severity"][fid][1]:
            lines.append(f"- Severity: {ledger['severity'][fid][1]}")
        if fid in ledger["fixes"]:
            lines.append(f"- Fix: {ledger['fixes'][fid]}")
        if fid in ledger["routes"]:
            lines.append(f"- Goes to: {ledger['routes'][fid]}")
        if duplicates.get(fid):
            lines.append(f"- Also raised as: {', '.join(sorted(duplicates[fid]))}")
        return "\n".join(lines) + "\n"

    titles = {
        "bar": "At the release bar",
        "high": "High",
        "medium": "Medium",
        "low": "Low",
    }
    kept = [f for f in primaries if verdict(f) in KEPT - {"Unverified"}]
    for sev, title in titles.items():
        group = sorted((f for f in kept if final_severity(ledger, f) == sev), key=lambda f: (finds[f]["path"], finds[f]["line"]))
        if group:
            out.append(f"## {title} ({len(group)})\n")
            out.extend(entry(f) for f in group)
    nits = sorted((f for f in kept if final_severity(ledger, f) == "nit"), key=lambda f: (finds[f]["path"], finds[f]["line"]))
    if nits:
        out.append(f"## Nits ({len(nits)})\n")
        out.extend(f"- {f} `{finds[f]['path']}:{finds[f]['line']}` {finds[f]['claim']}" for f in nits)
        out.append("")
    unverified = [f for f in primaries if verdict(f) == "Unverified"]
    if unverified:
        out.append(f"## Unverified ({len(unverified)})\n\nTrue or not, these couldn't be checked. They aren't counted in the scores.\n")
        out.extend(entry(f) for f in sorted(unverified))
    if ledger["decisions"]:
        out.append("## Decisions questioned\n")
        out.extend(f"- **{did}** `{path}:{line}`: {text}" for did, (path, line, text) in sorted(ledger["decisions"].items()))
        out.append("")
    refuted = [f for f in primaries if verdict(f) == "Refuted"]
    if refuted:
        out.append(f"## Refuted ({len(refuted)})\n")
        for f in sorted(refuted):
            disproof = ledger["refutes"].get(f, [("", 0, "", "")])[0]
            out.append(f"- {f} `{finds[f]['path']}:{finds[f]['line']}` {finds[f]['claim']} Disproved by `{disproof[0]}:{disproof[1]}`: {ledger['verdicts'][f][1]}")
        out.append("")

    spots = ledger["spots"]
    out.append("## Coverage\n")
    out.append(f"- {sum(1 for r in rows if r['path'] in ledger['notes'])} of {len(rows)} files in scope have a note, {sum(r['lines'] for r in rows)} lines in {len({r['slice'] for r in rows})} slices.")
    out.append(f"- {sum(1 for v in spots.values() if v[0] == 'accurate')} of {len(spots)} spot-checked notes matched their file.")
    if excluded:
        out.append(f"- {len(excluded)} files excluded as generated, vendored, lock or binary.")
    for tool, text in ledger["tools"]:
        out.append(f"- Tool `{tool}`: {text}")
    for gap in ledger["gaps"]:
        out.append(f"- Not checked: {gap}")
    out.append("")
    counts = Counter(verdict(f) for f in primaries)
    out.append(
        f"**Reconciled:** {len(finds)} findings raised, {len(ledger['dups'])} merged as duplicates, "
        + ", ".join(f"{v} {k.lower()}" for k, v in sorted(counts.items()))
        + f". Every one is listed above.\n"
    )
    if problems:
        out.append("## Ledger problems\n")
        out.extend(f"- {p}" for p in problems)
    (folder / "REPORT.md").write_text("\n".join(out), encoding="utf-8")
    print(f"wrote {folder / 'REPORT.md'}")
    return 0


def spots(args):
    commit, rows = read_scope(Path(args.dir))
    chosen = spot_sample(commit, rows)
    by_slice = defaultdict(list)
    for row in rows:
        if row["path"] in chosen:
            by_slice[row["slice"]].append(row["path"])
    for name in sorted(by_slice, key=lambda s: int(s[1:]) if s[1:].isdigit() else 0):
        print(f"{name}: {' '.join(sorted(by_slice[name]))}")
    return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    commands = parser.add_subparsers(dest="command", required=True)
    p = commands.add_parser("scope", help="list and slice the files to audit")
    p.add_argument("--out", required=True, help="the audit folder to create")
    p.add_argument("--max-lines", type=int, default=DEFAULT_MAX_LINES)
    p.add_argument("--months", type=int, default=12, help="history used for hotspots")
    p.add_argument("--exclude", action="append", default=[], help="glob of tracked files to leave out, such as third-party copies; repeatable")
    p.add_argument("paths", nargs="*", help="limit the audit to these paths")
    p = commands.add_parser("spots", help="list each slice's files whose notes a verifier checks")
    p.add_argument("dir")
    p = commands.add_parser("check", help="check the ledger")
    p.add_argument("dir")
    p = commands.add_parser("report", help="write REPORT.md from the ledger")
    p.add_argument("dir")
    p.add_argument("--force", action="store_true", help="write it even if check fails, marked incomplete")
    args = parser.parse_args()
    return {"scope": scope, "spots": spots, "check": check, "report": report}[args.command](args)


if __name__ == "__main__":
    sys.exit(main())
