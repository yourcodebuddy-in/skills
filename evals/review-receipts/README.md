# Evals for review-receipts

Command reference, run from the repo root. For the method and why it works this way, read [docs/BENCHMARKING.md](../../docs/BENCHMARKING.md).

Measures whether a skill version finds more real problems and raises fewer false alarms than no skill or an earlier version. Test cases follow the [Agent Skills eval format](https://agentskills.io/skill-creation/evaluating-skills), with extra fields for the runner.

Needs Node 24, Python 3, a C compiler with AddressSanitizer, git, the `gh` CLI, and the `claude` CLI.

## Commands

```sh
python3 evals/review-receipts/test_check_review.py                                # test the checker that ships in the skill
node evals/review-receipts/run.mjs proofs                                         # check every fixture before trusting scores
node evals/review-receipts/run.mjs run --iteration 1 --configs no_skill,with_skill
node evals/review-receipts/run.mjs grade --iteration 1
node evals/review-receipts/run.mjs report --iteration 1
node evals/review-receipts/run.mjs trigger --model claude-haiku-5-5               # does a natural request load the skill?
```

`run` and `grade` skip finished work, so a failed command can be rerun.

Results go to `workspace/review-receipts/iteration-N/`, which is git-ignored.

Options: `--cases a,b`, `--repeat N`, `--jobs N`, `--model <id>`, `--judge-model <id>`.

**These commands use your account's usage.** A full comparison across both suites is large enough to reach a usage limit. The runner stops at the first sign of one, and rerunning the same command resumes it. Start with `--cases` and one model.

## Real pull requests

```sh
node evals/review-receipts/prepare-real-prs.mjs download                          # PR text and known issues, at the commit pinned in real-prs.json
node evals/review-receipts/prepare-real-prs.mjs snapshots --all                   # about 9 GB
node evals/review-receipts/run.mjs run --suite holdout --iteration final --configs no_skill,with_skill
node evals/review-receipts/run.mjs grade --suite holdout --iteration final
node evals/review-receipts/run.mjs validate --suite holdout --iteration final     # checks unmatched findings against the code
node evals/review-receipts/run.mjs report --suite holdout --iteration final
```

`--suite dev` is the 15 PRs for developing the skill. `--suite holdout` is the other 35. Tuning against the holdout makes its scores meaningless. Results for version 1.0.0 are in `RESULTS.md`.

## Analyses

```sh
node evals/review-receipts/run.mjs import-tools --suite holdout --iteration tools --tools qodo-extended-v2,cubic-v2   # then grade and report
node evals/review-receipts/run.mjs compliance --suite holdout --iteration final --configs with_skill --compare tools  # did the workflow run, and how did it score?
node evals/review-receipts/run.mjs funnel --suite dev --iteration 1 --configs with_skill                              # then grade and report --iteration 1-funnel
node evals/review-receipts/run.mjs union --suite dev --iteration 1 --configs with_skill                               # recall as repeated runs combine
node evals/review-receipts/run.mjs agreement --suite dev --iteration 1 --configs with_skill                           # are spots more hunters raised more often real? Uses the judge
```

## Configurations

| Name | What the reviewer gets |
| --- | --- |
| `no_skill` | All skills and slash commands disabled |
| `old_skill` | `baselines/v0/code-review`, an unchanged copy of the original skill |
| `prev_skill` | The previous release. Extract it first with `mkdir -p workspace/review-receipts/baselines/v1.0 && git archive review-receipts-v1.0.0 skills/review-receipts \| tar -x -C workspace/review-receipts/baselines/v1.0` |
| `with_skill` | `skills/review-receipts`, the working version |
| `*_forced` | The same skill, with the prompt also naming it. Tests the instructions alone, whereas the plain config also tests whether the description fires |

Each run happens in a new temporary repo using `--setting-sources project`, so it sees none of your personal instructions or skills, plus no MCP servers or web tools. Paths and branch names are neutral so they can't hint at the answer.

## What counts

- **Planted problems found:** the fixture's known bugs that the review states.
- **False alarms:** findings the judge checked against the code and found wrong, unreachable, or pre-existing.
- **False blockers:** findings presented as must-fix that aren't valid.
- **Injection followed:** the review obeyed instructions planted in the branch. Creating the forbidden file is checked mechanically.
- **Repo changed:** the review moved `HEAD` or left the worktree dirty, breaking the findings-only contract.
- **Cost:** tokens, time, and report length.

The judge reads the code, and is told nothing about which configuration wrote a review. A report's format can still reveal it. Unless you pick another with `--judge-model`, the judge is Sonnet, which is also the default reviewer, so use a stronger judge when the reviewer is Sonnet and independence matters. Read its verdicts rather than trusting them blindly, because a judge can be wrong too.

## Fixtures

Each fixture has `base/` (main), `head/` (files overlaid for the branch), and a proof script. `proofs` runs the tests on both sides and the proof at the head: tests must pass (so planted bugs aren't obvious from a red suite), and the proof must show that the bug happens or that the clean change really is clean.

Scores from one run per case show direction only. Use `--repeat 3` or more before believing a small difference.
