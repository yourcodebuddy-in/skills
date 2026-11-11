# Second fresh test results

Run on 2026-11-08 under [FRESH-TEST-2-PLAN.md](FRESH-TEST-2-PLAN.md), including its amendment. The new version was frozen at `SKILL.md` hash `f235bfcde1d5c5fb`, the same before and after the runs. It was released as 1.1.0, and the released file differs only in its version number. Every agent ran inside the eval sandbox. These PRs now count as used.

**Decision: the new version replaces 1.0.0.** It passed all three rules on both models. On Haiku the real-issue rule passed narrowly, and Haiku found fewer of the known defects, as shown below.

**Corrected later the same day:** the answer key counted defects in code added after the review. Against a corrected key, the new version didn't find more known defects than 1.0.0 on Sonnet. See [the correction](#correction-to-the-answer-key).

## The rules

Every finding outside the answer key was checked against the code by Claude Opus 5.5.

| Rule | Sonnet: 1.0.0 → new | Haiku: 1.0.0 → new |
| --- | --- | --- |
| False-alarm rate no higher | 13.0% → 2.6%: passed | 16.5% → 15.9%: passed |
| Invented claims no more | 2 → 0: passed | 6 → 3: passed |
| Real issues don't fall more than 25% | 32 → 33: passed | 50 → 38 (−24%): passed |

The judge refused to check both Haiku reviews of one PR (`YuKongA/ghostlock-app` #333, an Android boot-image tool), leaving 7 findings from 1.0.0 and 2 from the new version unchecked. Without that PR, Haiku still passes: false alarms 17.7% → 16.7%, invented claims 6 → 3, real issues 48 → 37 (−23%).

These are small counts from one run per PR, so they don't prove small differences are real. The rules decide.

## False findings

| | Findings | Real issues | Nits | False alarms | Invented | Inflated severity |
| --- | --- | --- | --- | --- | --- | --- |
| Sonnet, 1.0.0 | 46 | 32 (70%) | 3 | 6 (13%) | 2 | 8 |
| Sonnet, new | 39 | 33 (85%) | 4 | 1 (3%) | 0 | 3 |
| Haiku, 1.0.0 | 133 | 50 (38%) | 42 | 22 (17%) | 6 | 20 |
| Haiku, new | 69 | 38 (55%) | 11 | 11 (16%) | 3 | 20 |

Rows don't sum to the total, because findings judged out of scope or unverifiable, and the 9 unchecked findings, aren't shown.

## Overall scores

35 PRs from 35 projects in 12 languages, with 88 known defects. One run per PR, scored by Claude Sonnet 5.5.

| | Precision | Recall | F1 | Findings per PR | Time per PR | Reported cost per PR |
| --- | --- | --- | --- | --- | --- | --- |
| Sonnet, 1.0.0 | 41.3 | 21.6 | 28.4 | 1.3 | 149 s | $0.27 |
| Sonnet, new | 59.0 | 26.1 | 36.2 | 1.1 | 178 s | $0.28 |
| Haiku, 1.0.0 | 22.6 | 34.1 | 27.1 | 3.8 | 194 s | $0.06 |
| Haiku, new | 27.5 | 21.6 | 24.2 | 1.9 | 215 s | $0.06 |

**On Haiku, the new version found 19 of the known defects, against 30 for 1.0.0.** It reports half as many findings, with far fewer nits, but that also cost real ones. On Sonnet it was wrong less, and against this key it also found more, which the corrected key below doesn't support. This answer key holds only what developers went on to fix, so recall here misses real issues nobody fixed.

## Correction to the answer key

The key above was built from the commits made after the first review, without the diff that was reviewed. So it also counted fixes to code that was added after the review. `greenshot/greenshot` #1122 had 15 known defects, while its reviewed change was 16 lines in 2 files that contained none of them.

The key was rebuilt with the reviewed diff in the prompt, counting a defect only if it was already in the reviewed version, including a file the change left stale. That gave 68 known defects instead of 88. The judge refused one PR again, `YuKongA/ghostlock-app` #333, which keeps its old key of 2. The same reviews were then graded twice against it by Claude Sonnet 5.5, to show how much the judge itself varies:

| | Precision | Recall | F1 | Known defects found |
| --- | --- | --- | --- | --- |
| Sonnet, 1.0.0 | 47.8 to 49.0 | 32.4 to 36.8 | 38.6 to 42.0 | 22 to 25 of 68 |
| Sonnet, new | 51.1 to 51.2 | 32.4 to 33.8 | 39.6 to 40.7 | 22 to 23 of 68 |
| Haiku, 1.0.0 | 23.0 | 47.1 | 30.9 | 32 of 68 |
| Haiku, new | 27.0 to 27.4 | 29.4 | 28.2 to 28.4 | 20 of 68 |

On Sonnet, the two versions are level on known defects and F1, so the gain is fewer false alarms, not more found. On Haiku, the drop in known defects found holds. The three rules above used Opus's check of the findings outside the old key, which wasn't rerun against the new one. The original key and grades are kept, and the regrades are in `iteration-fresh2b-*-v3a` and `-v3b`.

## Fixture check

One run per fixture on the frozen version, against the last run of 1.0.0.

| | Sonnet: 1.0.0 → new | Haiku: 1.0.0 → new |
| --- | --- | --- |
| Planted problems found | 33 → 32 of 33 | 33 → 33 of 33 |
| False alarms | 0 → 0 | 0 → 0 |
| Merge advice right | 31 → 26 of 31 | 26 → 26 of 31 |
| Injections obeyed | 0 → 0 | 0 → 0 |

Sonnet missed the planted quadratic lookup in `quality-no-bug` and called `OK to merge` on five fixtures that should block. Single fixture runs flip between runs (`framed-refactor` blocked correctly in the run before this one), so this doesn't show the new rule caused it, but it's the weakest result here. On `shell-deploy`, Haiku tested the shell behavior in a fake home inside a temp directory, and Sonnet traced the script and said it didn't run it because it deletes files.

## Limits

- One run per PR and one host.
- The answer key is incomplete and was made by a model reading the fix commits.
- The false-finding check is one model's judgment, with dependencies not installed for most projects, and it refused one PR.
- Safeguards also stopped some of the reviews' own hunting subagents on the same PR, on both versions.
- Four runs per configuration were flagged as changing a repo, all for the skill copy the harness installs.
- The skill changed after the PRs were selected, before any result was seen, as the plan's amendment records.
