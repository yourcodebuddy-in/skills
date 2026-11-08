# How to benchmark a code review skill

This is how `review-receipts` 1.0.0 was measured, written so a person or an AI agent can repeat it, extend it, and avoid our mistakes. The numbers are in [RESULTS.md](../evals/review-receipts/RESULTS.md), and the command reference is in [the suite's README](../evals/review-receipts/README.md). The rules apply to any skill. See "Benchmarking a different skill" for what carries over.

## The rules

Each rule exists because skipping it misled us or would have.

1. **Compare against a baseline.** Always run no skill, or the previous version, on the same cases. Without one you can't tell the skill's effect from the model's.
2. **Use clean-room runs.** Each run gets a new temporary repo that can't see your personal instructions, other skills, MCP servers, or the web. Branch names and paths are neutral, so they can't hint at the answer.
3. **Prove the test cases.** Every planted bug has a script showing it really happens, and every "clean" change has one showing it really is clean. A fake bug makes every score meaningless.
4. **Keep some data unseen.** Develop on one set of PRs and report on another. Once you've chosen a change because of a set's results, that set is no longer unseen.
5. **Calibrate the judge.** Before trusting your judge, score published tools with it and check that it reproduces their published numbers.
6. **Use one judge for everyone.** Judges differ. On the two tools we compared directly, our Sonnet judge scored 3 to 7 points higher than our Opus judge, so scores only compare within one judge. Put published tools through the same judge as your own runs.
7. **Don't trust the answer key alone.** Known-issue lists are incomplete. Check unmatched findings against the real code. In one check of an earlier version, 45 of 63 findings counted as false positives were judged real issues.
8. **Check what really ran.** A skill's instructions aren't its behavior. Read the transcripts to see whether the steps happened before crediting or blaming them.
9. **Repeat runs before believing a gap.** Identical runs on the same 15 PRs have scored as far apart as F1 44.2 and 32.1.
10. **Have a stronger model recheck strong claims,** and run the code yourself when you can. Rechecking moved "0 false alarms" to 3, and running a C program overturned two judge verdicts.
11. **Watch usage.** Model runs draw on your plan or budget. On Haiku runs, grading has cost about as much as the reviews.

## What we measure

| Question | How | Command |
| --- | --- | --- |
| Does it catch real bugs, with little noise? | 50 real PRs with known issues, giving precision, recall, and F1 | `run`, `grade`, `report` with `--suite` |
| Are the "false positives" actually wrong? | Each unmatched finding is checked against the code | `validate` |
| How does it compare with the market? | Published reviews go through the same judge | `import-tools`, `grade`, `report` |
| Does it fall for specific traps? | 32 proven fixtures: invented claims, inflated severity, contradictions, overbuilt fixes, wrong merge advice, prompt injection, and many project types | `proofs`, `run`, `grade`, `report` |
| Does it load when people ask in plain words? | 16 requests that should load it, and 10 near misses | `trigger` |
| Did the workflow really run? | Reads each transcript, and scores runs that followed it against runs that skipped it | `compliance` |
| Where do bugs get lost? | Scores the hunters' list and the merged list separately | `funnel` |
| Would more passes help? | Recall as runs are combined | `union` |

## Setup

You need Node 24, Python 3, a C compiler with AddressSanitizer, git, the `gh` CLI signed in, and the `claude` CLI.

```sh
node evals/review-receipts/run.mjs proofs                            # all 32 fixtures should say ok
python3 evals/review-receipts/test_check_review.py                   # the checker's own tests
node evals/review-receipts/prepare-real-prs.mjs download             # PR text and known issues, at a pinned commit
node evals/review-receipts/prepare-real-prs.mjs snapshots            # dev set, about 3 GB. Add --all for all 50, about 9 GB
```

## Measuring a change

Start small, and approve larger runs knowingly. On our plan, one Haiku pass over the 15 development PRs used about $1 of reported usage, and one Sonnet pass about $4 to $6.

**1. Check the fixtures on the cheapest model:**

```sh
node evals/review-receipts/run.mjs run --iteration my-change --configs with_skill --model claude-haiku-5-5 --jobs 6
node evals/review-receipts/run.mjs grade --iteration my-change --jobs 6
node evals/review-receipts/run.mjs report --iteration my-change
```

**2. Try the development PRs, repeated, against the previous version:**

```sh
node evals/review-receipts/run.mjs run --suite dev --iteration my-change-real --configs old_skill,with_skill --repeat 3 --model claude-haiku-5-5 --jobs 6
node evals/review-receipts/run.mjs grade --suite dev --iteration my-change-real --jobs 6
node evals/review-receipts/run.mjs report --suite dev --iteration my-change-real
node evals/review-receipts/run.mjs compliance --suite dev --iteration my-change-real --configs with_skill
```

To compare with an earlier version, copy it into the suite's `baselines/` folder and point `old_skill` at it in `CONFIGS` in `run.mjs`.

**3. Find out why, if the score moved.** Read reports and transcripts in `workspace/review-receipts/iteration-*/eval-*/*/run-*/outputs/`. Then look at the funnel:

```sh
node evals/review-receipts/run.mjs funnel --suite dev --iteration my-change-real --configs with_skill
node evals/review-receipts/run.mjs grade --suite dev --iteration my-change-real-funnel --jobs 6
node evals/review-receipts/run.mjs report --suite dev --iteration my-change-real-funnel
```

If recall on the hunters' list is low, the hunt failed. If it's high and the report's recall is low, the merge or the verification lost the bugs. In one Sonnet run over the development PRs, the hunters' lists together covered 84% of known issues while the report covered 56%. On Haiku the gap was much smaller, at 78% and 76%.

## Reporting a result

Do this only when you've finished choosing changes.

```sh
node evals/review-receipts/run.mjs run --suite holdout --iteration final --configs no_skill,old_skill,with_skill --model claude-sonnet-5-5 --jobs 6
node evals/review-receipts/run.mjs grade --suite holdout --iteration final --jobs 6
node evals/review-receipts/run.mjs validate --suite holdout --iteration final --configs with_skill --judge-model claude-opus-5-5 --jobs 5
node evals/review-receipts/run.mjs import-tools --suite holdout --iteration tools --tools qodo-extended-v2,cubic-v2,augment,bugbot,claude-code,copilot-v2,greptile-v4-1,coderabbit
node evals/review-receipts/run.mjs grade --suite holdout --iteration tools --jobs 6
node evals/review-receipts/run.mjs report --suite holdout --iteration final
node evals/review-receipts/run.mjs report --suite holdout --iteration tools
node evals/review-receipts/run.mjs compliance --suite holdout --iteration final --configs with_skill --compare tools
```

Then run the fixtures and `trigger` on each model, and update `RESULTS.md` and the skill's page in `docs/skills/`.

**No real-PR set is unseen any more:** the holdout has been used twice, and each of the two fresh samples once. A new claim of improvement needs a new sample. Write the plan and success rules first, as in [FRESH-TEST-PLAN.md](../evals/review-receipts/FRESH-TEST-PLAN.md), then draw it with a new seed using `prepare-fresh-prs.mjs`. Its answer key comes from what developers fixed after review, the same idea as [Martian's online benchmark](https://github.com/withmartian/code-review-benchmark).

## Extending it

**Add a fixture:**

1. Create `evals/review-receipts/fixtures/<id>/base/` for main, and `head/` for the files the branch changes. Use neutral names, with no comment hinting at the bug.
2. Add a proof script beside them that exits 0 if the bug happens, or if a clean change really is clean.
3. Add an entry to `evals/review-receipts/evals.json` with the prompt, the commit message, the test and proof commands, the planted problems, and `expected_merge`.
4. Run `node evals/review-receipts/run.mjs proofs`. Tests must pass on both sides, so the bug can't be spotted from a red test suite.

**Add a model:** pass `--model`. Test the cheapest model you plan to support, since weak instructions show up there first.

**Add a host:** the runner only drives Claude Code today. For Codex, we copied the skill into `.agents/skills/` in a test repo and ran `codex exec --json -m <model> --sandbox workspace-write --skip-git-repo-check -o <file> "<prompt>"`. Teaching `runOne` this would let every suite run on Codex.

## Benchmarking a different skill

Each skill gets its own `evals/<skill>/` folder, run data in `workspace/<skill>/`, and results in its own `RESULTS.md`.

The rules above carry over, and so does the clean-room part of `evals/review-receipts/run.mjs`: building a temporary repo, installing the skill, running the agent, recording tokens and time, reading the transcript, and stopping at usage limits. What changes is what "good" means: the test cases, the judge's prompt, and the scores.

Copy that runner and change those parts. Move shared code into one place only when a second suite shows what's really shared, because guessing now would likely get it wrong.

For a skill that doesn't review code, you still need the same four things: cases where the right answer is proven, a baseline to beat, a judge you've checked against something known, and a look at what really ran.

## What we learned

**Mistakes in measurement:**

- **One run looks like a result.** We credited a jump from F1 27.8 to 48.7 to a new instruction. The transcripts showed the models never followed it, so it was mostly noise.
- **Comparing runs that chose for themselves.** On an earlier version, Sonnet runs that used the hunters scored 63.0 and runs that skipped them scored 46.0, which looked like the answer. But the top tool also scored higher on the PRs where hunters ran (64.9 vs. 56.0), so part of the gap came from the PRs themselves. Then making nearly every run use the hunters didn't raise Sonnet's overall score. Use `--compare`.
- **Scoring the last message.** A host can send a closing message after the report, which then gets scored in its place. The runner now scores the report itself.
- **Recording failures as results.** Hitting a usage limit once wrote 60 failed runs that looked like scores of zero. The runner now stops at the limit and can resume.
- **Trusting a judge too far.** Judges made real errors. Rerun or read anything surprising.
- **Letting agents touch the real machine.** A reviewer testing a fixture's cleanup script mistyped a variable, so the script ran `rm -rf` in the real home folder and deleted most of the Desktop before the agent stopped it. Its report said so in its first line, but only scores were read. Every agent now runs in a sandbox that can only write to temp folders, and fixtures that delete files are traced rather than run.
- **Reading scores without reading reports.** The deletion above was in a report that scored normally. Read a sample of reports, and every report from a run where something unexpected happened.

**About skills and models:**

- **A strong signal doesn't guarantee a better rule.** On one run per model over the development PRs, a spot raised by all three hunters matched a known issue about 48% of the time, against about 15% for a spot raised by one. So we tried requiring more proof for spots fewer hunters raised, and the checker enforced it. Over 3 runs each on Haiku, it averaged F1 45.1 against 47.7 without it, finding fewer known issues (64.3% vs. 70.5%) and removing almost no noise. We dropped the rule, and `agreement` remains for measuring the signal.
- **Replaying old reports can mislead.** Replaying Haiku's reports with a cap of five findings predicted F1 of about 51, but rerunning with the cap scored 42.8, because models change what they write once a rule exists. Haiku also listed the "omitted" points anyway, which moved the noise rather than removing it. Use a replay to choose what to test, not to decide.
- **Tighter reports traded recall for precision on Haiku.** Limiting questions and pre-existing findings cut Haiku's false positives per run from 54 to 37, but known issues found fell from 70.5% to 56.6%, leaving F1 about level. On Sonnet, 2 runs averaged 52.4 against 47.8 over 3 runs of the old version, on the development PRs. That's a small sample, so it needs fresh PRs to confirm.
- **Test on code you haven't studied.** On a fresh sample, Opus judged 15% to 20% of findings false alarms, against about 6% for Sonnet on the benchmark we developed around. Rules chosen in advance also stopped a version that looked better overall from shipping, because its false-alarm rate rose.
- **Keep the simpler version when a rule's gain is within noise.** Requiring code to be named before dropping what all three hunters raised averaged 53.9 against 52.4 on Sonnet and 46.9 against 46.7 on Haiku. That's smaller than the swing between identical runs, and it slowed runs, so we left it out.
- **Instructions alone don't change behavior.** Models skipped steps they judged unnecessary, and said so. Three things helped: putting the step before the work it might be skipped in favor of, stating that the request authorizes it, and having a script reject incomplete notes.
- **Bugs get missed at random.** On 15 development PRs, combining three separate Haiku reviews raised recall from about 47% to about 70%, and three Sonnet reviews from about 33% to about 49%. This counts recall only, so it says nothing about false positives.
- **A cheaper model isn't always worse at hunting.** On one version, Haiku wrote down 4.9 suspects per run and Sonnet 3.2. Sonnet seemed to filter more before writing anything down, but we only saw the notes, not its reasoning.
- **Filtering is where recall goes.** No-skill runs report nearly everything, so they have high recall and poor precision. Any filter trades some recall for precision, so measure both.
- **Separate noise from false alarms.** Most unmatched findings weren't wrong. They were real bugs missing from the list, or true but unimportant nits, and each needs a different fix.
- **Unused instructions are dead weight.** Verifier subagents were started in only a handful of runs of an earlier version and in none of the last 70, so we removed them.

**How the original skill compared.** The first baseline used 15 small fixtures and 3 runs each. The original skill's instructions were strong when named in the prompt, with 51 of 51 problems found, but its description failed on common wording, so it fired on only 33 of 45 runs. In 3 of 12 injection runs as installed, it also treated a branch's edits to `AGENTS.md` as project policy. Those two failures shaped the rewrite.

## Still open

- **Precision.** The top tools report fewer non-issues. This is the main gap, especially on Haiku.
- **Workflow completion.** In testing of 1.0.0, the checker reached PASS on 27 of 35 Sonnet runs and 22 of 35 Haiku runs.
- **Haiku's recall in 1.1.0,** which found 19 of 88 known defects on fresh PRs, against 30 for 1.0.0.
- **Haiku's merge advice,** which was right on 26 to 27 of 31 fixtures in the last two runs.
- **Other hosts.** Subagents are untested on Codex, and other agents haven't been tried.
- **Fresh PRs,** for any new claim about real-PR performance. Both samples drawn so far are used.
