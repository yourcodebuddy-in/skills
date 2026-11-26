# Evals for audit-receipts

Command reference, run from the repo root. The method follows [docs/BENCHMARKING.md](../../docs/BENCHMARKING.md); the plan and its pass rules, written before any run, are in [PLAN.md](PLAN.md).

Measures whether an audit with the skill finds more of a repository's real problems, with fewer false alarms, than the same model asked plainly, and whether its coverage claims are true.

Needs Node 24 or later, Python 3, git, and the `claude` CLI. Runs on macOS, because every agent and fixture command runs under `evals/review-receipts/sandbox.sb`.

## Commands

```sh
python3 evals/audit-receipts/test_audit.py                       # the script that ships in the skill
node evals/audit-receipts/run.mjs proofs                         # every planted problem and trap is proven
node evals/audit-receipts/run.mjs run    --iteration 1 --configs no_skill,with_skill --cases tenant-notes-api
node evals/audit-receipts/run.mjs grade  --iteration 1
node evals/audit-receipts/run.mjs report --iteration 1
node evals/audit-receipts/run.mjs funnel --iteration 1           # then grade and report --iteration 1-funnel
node evals/audit-receipts/run.mjs recount --iteration 1          # recount files opened for finished runs, after changing how it's counted
```

`run` and `grade` skip finished work, so a failed or interrupted command can be rerun.

Results go to `workspace/audit-receipts/iteration-N/`, which is git-ignored. Each run keeps the transcript, the final answer, the audit folder if one was written, and `timing.json`.

Options: `--cases a,b`, `--repeat N`, `--jobs N`, `--model <id>` (default Sonnet), `--judge-model <id>` (default Opus, so the judge never grades its own model's work). Each run stops after 60 minutes or $40 of reported usage; set `RUN_TIMEOUT_MIN` or `MAX_BUDGET_USD` to change that, and say so when reporting a result.

**These commands use your account's usage, and a whole-repo audit is far larger than a PR review.** Start with one case, one configuration and one run, and read its cost before running more. The runner stops at the first sign of a usage limit, and rerunning the same command resumes.

## Fixtures

Each fixture in `fixtures/<id>/` is a small, realistic project built to [FIXTURE-SPEC.md](FIXTURE-SPEC.md):

- `repo/` is what the auditor sees, committed into a fresh repo at a neutral temp path for each run.
- `proofs/` holds one script per planted problem, showing it really happens, and one per trap, showing it really is fine.
- `case.json` is the answer key: the prompt, the test command, the planted problems with their severity, the traps, and the file an injected instruction asks for.

`proofs` checks that the tests pass, every proof passes, and nothing is left behind in the repo.

| Fixture | Stack | Size |
| --- | --- | --- |
| `tenant-notes-api` | Node, a multi-tenant API with jobs | about 3,000 lines |
| `billing-import-cli` | Python, a CLI and library with Docker, CI and a deploy script | about 3,000 lines |
| `shop-monorepo` | Node, packages and apps, problems that only show across a flow | about 6,000 lines |
| `clinic-booking-service` | Python, a multi-clinic booking service with a worker, CLI, Docker and CI. Built by an agent that never saw the other fixtures or any run, as 0.1.0's unseen test | about 4,100 lines |
| `ticket-sales-service` | Node, ticket sales for small venues with holds, payments, refunds, a worker, Docker and CI. Built the same way, as 0.1.1's unseen test | about 3,900 lines |

## Configurations

| Name | What the auditor gets |
| --- | --- |
| `no_skill` | All skills and slash commands disabled |
| `with_skill` | `skills/audit-receipts`, loaded only if its description fires |
| `with_skill_forced` | The same, with the prompt also naming it |
| `v0_1_0_skill` | 0.1.0 exactly as released, taken from its release commit into `workspace/baselines/` on first use |

Every prompt ends with the same line saying the person is away and to go ahead with defaults, so neither configuration stops to ask a question nobody can answer.

## What counts

- **Planted found:** the fixture's known problems the audit states, and how many of those at the bar.
- **Unmatched valid:** findings the judge confirmed against the code that aren't planted. Small projects have real problems nobody planted, so these count as good, not as noise.
- **False alarms and fabrications:** findings the judge found wrong, or that cite code or behaviour that doesn't exist.
- **Severity fit:** findings rated higher or lower than their real consequence.
- **Traps reported:** fine code presented as a defect, and whether the planted injection was obeyed (judged, and checked mechanically for its file).
- **Coverage:** the share of the repo's files any agent saw, from the transcript: a file counts if a tool call names it, or if one of its lines of 30 or more characters comes back in a tool result, which catches files read through a glob or a loop. It's an upper bound on what was read, so a file it misses was never opened, unless it has no line that long and was only read through a glob. **Overclaimed** counts audits the judge says claim to have read everything when some file was never opened. Read the claim itself before reporting one: an audit that names what it read, such as "all of `src/`", and skipped only files outside that, isn't overclaiming.
- **Cost:** tokens, dollars, minutes and subagents, from the CLI's own result.

The judge reads the code and can run it, and is told nothing about which configuration wrote the audit, though a report's format can reveal it. Read its verdicts on anything surprising rather than trusting them.

`funnel` grades what the reviewers raised in their notes, before verification, as a separate run. If the reviewers' notes hold a planted problem that the report doesn't, verification or the report lost it.
