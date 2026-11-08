# Second fresh test plan

Written on 2026-11-08, before any PR in this sample was selected or any result was seen. The first fresh test is used up, because the wrong findings it revealed shaped the version under test here.

## Question

Is the new version better than `review-receipts` 1.0.0 on pull requests that neither was developed against?

The new version differs from 1.0.0 in these ways:

- At most one question per report, pre-existing bugs listed only if they'd be a Must fix were they new, and a count of minor points with no description of them.
- Verification rules moved into `SKILL.md`, because runs rarely opened the separate file. They now require a real path to the code, a search before claiming something is missing, and an outside fact to be checked or dropped.
- A new step where a fresh subagent tries to refute every finding before the report is written.

## On the development PRs

The stated gate was that wrong findings fall on Haiku and don't rise on Sonnet. Haiku passed, going from 21 to 9 wrong findings over 3 runs. Sonnet failed, going from 2 to 7 over 2 runs. A refuting step can only remove findings, so this rise is probably run-to-run noise, but that can't be shown from this data. So the version goes forward with Sonnet unproven, and this test decides.

## The pull requests

The same rules and procedure as [the first fresh test](FRESH-TEST-PLAN.md), using the candidates found by its search, with these differences:

- The seed is `fresh-2-2026-11-08`.
- No repository from the first sample is used, including its reserves.

Blocks of bot-written text get removed from PR descriptions before any run, and any new kind found gets recorded.

## What gets run

One run per PR for `prev_skill` (1.0.0) and `with_skill` (the new version), on Sonnet and on Haiku. The skill stays frozen for the whole test. A judge (Claude Sonnet 5.5) matches each report to the answer key, and a judge (Claude Opus 5.5) checks every finding not in the key against the code.

## What counts as success

The same rules as before, with false findings first. The new version replaces 1.0.0 only if all of these hold on both models:

1. **False-alarm rate** (wrong findings divided by all findings) is no higher than 1.0.0's.
2. **Invented claims** are no more than 1.0.0's.
3. **Real issues found** (findings matching the answer key plus unmatched findings judged valid) don't fall by more than 25%.

If only some hold, the new version doesn't ship as an improvement, and the report says so. Passing doesn't prove a small difference is real, since this is one run per PR.

## Rules while running

- No change to the skill between selecting PRs and finishing the runs.
- The answer key isn't read before the runs.
- All results get published, whichever way they go.

## Record

- **PRs that couldn't be built, and were replaced by reserves:** `fleetdm/fleet` #56872 and `googleapis/google-cloud-cpp` #16315 (repos over about 2 GB), and `woocommerce/woocommerce` #69765 (its patch didn't apply).
- **Sample:** 35 PRs in 12 languages, 28 with later commits and 7 without, with 88 known defects from the answer key.
- **Text left in PR descriptions:** non-bot workflow markers on 2 PRs (`pimcore/pimcore` #19441 and `NVIDIA/NemoClaw` #9040), which hold workflow IDs only. No new kind of bot-written block was found.
- **Frozen version:** `SKILL.md` hash `6d38eb1b47482a0e`, recorded before the runs.
- **Fixture check before the runs (one run each):** all 33 planted problems found on both models, with no false alarms and no injection obeyed. On Sonnet, merge advice fell from 31 to 28 of 31 and understated severity rose from 0 to 4, compared with 1.0.0. This test can't settle that, but its results should be read with it in mind.

## Amendment, 2026-11-08, before any result was seen

The first attempt was stopped partway, with 55 of 70 Haiku runs done and none graded. During the fixture check before it, an agent ran a fixture's deletion script with an unset variable, outside any sandbox, and deleted most of the machine's Desktop. Two things changed before the rerun, with no report, grade or answer key read:

- **Sandbox:** every agent and fixture command now runs under `sandbox.sb`, which denies writes outside temp folders, Claude's own state and caches.
- **Skill:** a ground rule was added: code from the change runs only in a confined temp copy, and anything that deletes or moves files and can't be confined is traced instead of run. This breaks the rule above that the skill doesn't change after PR selection. It was accepted because no result had been seen.

The rerun uses new folders (`iteration-21-*` for the fixture check, `iteration-fresh2b-*` for the PRs), and its results are the ones reported. The 55 earlier runs are kept in `iteration-fresh2-haiku` and not used.

- **Frozen version for the rerun:** `SKILL.md` hash `f235bfcde1d5c5fb`.

