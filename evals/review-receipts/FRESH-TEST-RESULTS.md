# Fresh test results

Run on 2026-11-07 under [FRESH-TEST-PLAN.md](FRESH-TEST-PLAN.md), which set the method and the success rules before any PR was selected. The candidate's instructions were unchanged throughout, confirmed by comparing the file's hash before and after the runs. These PRs now count as used.

**Decision: the candidate does not replace 1.0.0.** It failed two of the three rules on both models.

## The rules

Every finding outside the answer key was checked against the code by Claude Opus 5.5.

| Rule | Sonnet: 1.0.0 → candidate | Haiku: 1.0.0 → candidate |
| --- | --- | --- |
| False-alarm rate no higher | 17.6% → 20.0%: failed | 15.3% → 19.3%: failed |
| Invented claims no more | 2 → 3: failed | 6 → 8: failed |
| Real issues don't fall more than 25% | 33 → 36: passed | 51 → 48: passed |

These are small counts from one run per PR, so they don't show the candidate is really worse on false alarms. They do fail the rules set in advance, and the rules decide.

## False findings

| | Findings | Real issues | Nits | False alarms | Invented | Inflated severity |
| --- | --- | --- | --- | --- | --- | --- |
| Sonnet, 1.0.0 | 51 | 33 (65%) | 5 | 9 (18%) | 2 | 10 |
| Sonnet, candidate | 55 | 36 (65%) | 6 | 11 (20%) | 3 | 14 |
| Haiku, 1.0.0 | 137 | 51 (37%) | 61 | 21 (15%) | 6 | 25 |
| Haiku, candidate | 109 | 48 (44%) | 33 | 21 (19%) | 8 | 36 |

Rows don't sum to the total, because findings judged out of scope or unverifiable aren't shown.

**This is much worse than the benchmark in [RESULTS.md](RESULTS.md) showed,** where Opus judged about 6% of Sonnet's findings false on an answer key from well-known PRs. Treat the higher figure as the more realistic one for code the skill hasn't seen. The two sets differ in projects, answer key, and how findings were sorted, so the gap isn't a precise measure.

## Overall scores

35 PRs from 35 projects in 12 languages, with 69 known defects. One run per PR, scored by Claude Sonnet 5.5.

| | Precision | Recall | F1 | Findings per PR | Time per PR | Reported cost per PR |
| --- | --- | --- | --- | --- | --- | --- |
| Sonnet, no skill | 19.8 | 29.0 | 23.5 | 2.9 | 29 s | $0.11 |
| Sonnet, 1.0.0 | 31.4 | 23.2 | 26.7 | 1.5 | 171 s | $0.28 |
| Sonnet, candidate | 36.4 | 29.0 | 32.3 | 1.6 | 182 s | $0.29 |
| Haiku, no skill | 8.8 | 18.8 | 12.0 | 4.2 | 56 s | $0.01 |
| Haiku, 1.0.0 | 15.9 | 31.9 | 21.3 | 3.9 | 153 s | $0.06 |
| Haiku, candidate | 23.6 | 37.7 | 29.1 | 3.1 | 168 s | $0.06 |

These scores are lower than the benchmark's and can't be compared with it, because this answer key holds only what developers went on to fix, so it misses real issues nobody fixed. False findings weren't checked for the no-skill rows, so these figures say nothing about whether the skill reduces them.

## Review bots on the same PRs

Each bot only reviewed some PRs, so each row uses that bot's PRs only, with one judge. The table favors the bots: developers often fixed what a bot had flagged, and those fixes then became the answer key. Only the bots' comments from before the first fix count.

| Bot | PRs | Known defects | Bot F1 | Sonnet + candidate F1 | Haiku + candidate F1 |
| --- | --- | --- | --- | --- | --- |
| CodeRabbit | 12 | 35 | 45.2 | 34.4 | 33.3 |
| Greptile | 9 | 25 | 50.0 | 24.2 | 30.4 |
| Copilot | 8 | 9 | 10.0 | 21.1 | 27.0 |
| cubic | 5 | 10 | 33.3 | 35.3 | 25.0 |
| Cursor | 5 | 5 | 20.0 | 0.0 | 25.0 |
| Gemini | 3 | 5 | 16.7 | 22.2 | 16.7 |
| Claude | 3 | 9 | 60.0 | 15.4 | 40.0 |

With this few PRs per bot and this bias, the table doesn't rank anyone. False findings weren't checked for the bots.

## Workflow

The candidate ran the hunting passes on 32 of 35 PRs on Sonnet and 31 of 35 on Haiku, and reached the checker's PASS on 31 and 28 of 35. No review changed the code. Eight runs were flagged as changing a repo, but the untracked files were the skill copy our test harness had installed.

## Limits

- One run per PR and one host.
- The answer key is incomplete, and it was made by a model reading the fix commits. A spot check of 3 PRs looked sound, and the rest weren't read by a person.
- The false-finding check is one model's judgment, with dependencies not installed for most projects.
- PR descriptions are the final versions with bot text removed, so a person's later edit could still hint at a fix. This applies to every configuration equally.
- 6 selected PRs were replaced by reserves, as recorded in the plan.
