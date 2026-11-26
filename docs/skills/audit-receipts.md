# Audit Receipts

**Whole-codebase audits that show their receipts.**

An audit skill for AI agents, for any language or kind of project. It reads every file, checks each finding against the code before reporting it, and scores each area of the codebase with the finding IDs behind every point lost. It covers bugs, security, design, dead and duplicated code, tests, docs that don't match the code, dependencies, config and CI, and the project's recorded decisions. Use it when you want to know how well a repo, package or service is written, or whether it's ready to build on. For one change or pull request, a review skill fits better.

From an audit of a test project:

```markdown
**Not ready to build on yet: the structure and tests are good, but four defects found and reproduced here must be fixed first, and the documented login lockout does not exist.**

| Area | Score | Why it isn't 10 |
| --- | --- | --- |
| Fees and payments | 3/10 | a provider error mid-batch charges cards repeatedly on every tick (F3-01, -3); wrong amounts in patient texts such as $12.5 (F3-03, -2); ... |

### F3-03: format_money does not zero-pad the cents, so 1205 cents prints "$12.5"
`clinicbook/formatting.py:13` · bug · Confirmed

- Code: `clinicbook/formatting.py:13` `return f"{symbol}{whole:,}.{cents}"`
- Proof: python3 -I -c "from clinicbook.formatting import format_money as f; print(f(1205,'USD'),f(1005,'USD'),f(1200,'USD'))" printed: $12.5 $10.5 $12.0
- Fix: format the cents as {cents:02d} and add test cases for 5, 1005 and 100 cents.

**Reconciled:** 68 findings raised, 23 merged as duplicates, 34 confirmed, 6 likely, 5 overstated. Every one is listed above.
```

## Install

```sh
npx skills add yourcodebuddy-in/skills --skill audit-receipts
```

Then ask in plain words, such as "audit this repo" or "how solid is this codebase?". The agent tells you the scope, the mode and the cost once, and waits for a go-ahead.

**Requirements:** git, a shell and Python 3. It works best on hosts that can start subagents. Otherwise the agent reviews each part itself, and says so in the report.

## How it works

Agents fail at audits in known ways. The skill answers each with something a script checks, not a promise:

| Problem | What the skill does |
| --- | --- |
| Saying files were read when they weren't | A script lists every tracked file and splits them into parts a reviewer can read whole. Every file needs a note from its reviewer saying what it does and what was checked, and a few notes, chosen from the commit so no reviewer knows which, are checked against their files by another agent |
| One reading misses bugs at random | One reviewer per part, plus reviewers that follow 3 to 8 flows across the whole system, such as "can a request reach another tenant's data?", written as questions so they don't steer the reviewer |
| Confident findings the code disproves | Every finding goes to a fresh agent that tries to disprove it. Refuting one needs a quote of the code that disproves it |
| Invented code | The script checks every quoted line against the file at the audited commit |
| Small problems rated as serious | A finding at the project's release bar needs proof: a failing test, a command and its output, or a quote from the installed library. Only a verifier can lower a severity, and only with a reason |
| Findings lost between the notes and the report | The report is generated from the saved notes by the script, and ends with a count that reconciles every finding raised |
| Instructions planted in the repo | Everything in the repo is data. The audit changes nothing, and runs code only in a throwaway copy |

Three modes: Quick (one reviewer per part), Standard (adds the flows, and is the default) and Deep (three reviewers on the most-changed parts). A verifier from another model family is used only if you offer one, since it sends your code to that vendor.

## Results

Each version is tested on a small project with 12 proven planted problems, built by an agent that never saw the skill's development runs, with Claude Sonnet auditing and Claude Opus judging. Version 0.1.1 was tested against 0.1.0 and no skill on a 3,945-line Node service, with two runs each:

| On the unseen fixture | No skill | 0.1.0 | 0.1.1 |
| --- | --- | --- | --- |
| Planted problems found | 20 of 24 | 22 of 24 | 21 of 24 |
| At the bar | 6 of 6 | 6 of 6 | 6 of 6 |
| Other real problems found | 13 | 68 | 62 |
| False alarms or invented code | 1 | 0 | 0 |
| Files opened | 95% | 100% | 100% |
| Severity wrong | 5 of 44 | 6 of 126 | 5 of 112 |
| Time and cost per audit | 1.5 min, $0.47 | 9.9 min, $6.06 | 10.6 min, $5.92 |

0.1.1 passed the release rules written before the run, but every difference from 0.1.0 is within what two runs of the same version vary by. 0.1.0's own release test, on a 4,100-line Python service, found 22 of 24 planted problems against 18 with no skill. On the three development fixtures, the skill found 71 or 72 of 72 planted problems against 37, and all 16 at the bar against 9.

**What to expect:** a plain request already finds most of the worst problems on a small project. The skill finds more of everything else, reads every file, and reports nothing it hasn't checked. One plain audit said it had read the whole codebase after skipping 6 files; no skill run has. It costs 10 to 20 times as much, and still sometimes misses a test that can't fail. The projects were 2,700 to 6,000 lines. Expect more time and cost on a real codebase, and results that may differ. See [evals/audit-receipts/RESULTS.md](../../evals/audit-receipts/RESULTS.md) for the full tables, the corrections made while measuring, and the limits.

## How it was measured

[docs/BENCHMARKING.md](../BENCHMARKING.md) explains the method. [evals/audit-receipts/](../../evals/audit-receipts/) holds the fixtures, their proofs, the runner, and the plan written before any run.

## Credits

The threat model and coverage sections follow how security firms such as [Trail of Bits](https://github.com/trailofbits/publications) write up audits.
