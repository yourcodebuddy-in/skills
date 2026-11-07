# Results for version 1.0.0

Measured on 2026-11-06 and 2026-11-07 in Claude Code. Raw output is in `workspace/review-receipts/`, which is git-ignored. [docs/BENCHMARKING.md](../../docs/BENCHMARKING.md) explains the method and how to repeat it.

## Real pull requests

35 real PRs from Sentry, Grafana, Cal.com, Discourse, and Keycloak, from [Martian's Code Review Bench](https://github.com/withmartian/code-review-benchmark) (MIT). Another 15 PRs from the same set were used to develop the skill and aren't counted here. Each row is one run per PR, with the skill installed and not named in the prompt. Everything was scored by one judge, Claude Sonnet 5.5, published tools included, using the benchmark's published reviews and its default "core" issue categories.

| Reviewer | Precision | Recall | F1 | Issues per PR | Time per PR | Reported cost per PR |
| --- | --- | --- | --- | --- | --- | --- |
| Qodo Extended | 63.9 | 60.0 | 61.9 | 3.1 | | |
| Cubic | 62.2 | 60.0 | 61.1 | 3.2 | | |
| Augment | 56.6 | 63.5 | 59.8 | 3.7 | | |
| **Sonnet + this skill** | **49.7** | **61.7** | **55.0** | **4.1** | **188 s** | **$0.33** |
| Bugbot | 61.1 | 47.8 | 53.7 | 2.6 | | |
| **Haiku + this skill** | **39.3** | **74.8** | **51.5** | **6.4** | **176 s** | **$0.08** |
| Copilot | 40.5 | 67.0 | 50.5 | 5.6 | | |
| Greptile | 51.4 | 47.8 | 49.5 | 3.2 | | |
| Sonnet + original skill | 40.2 | 60.9 | 48.4 | 5.1 | 36 s | $0.13 |
| Sonnet, no skill | 35.9 | 69.6 | 47.3 | 6.5 | 33 s | $0.11 |
| Haiku + original skill | 36.7 | 60.0 | 45.5 | 5.5 | 73 s | $0.02 |
| Claude Code plugin | 50.0 | 41.7 | 45.5 | 2.9 | | |
| CodeRabbit | 34.0 | 61.7 | 43.8 | 6.4 | | |
| Haiku, no skill | 28.6 | 67.8 | 40.2 | 8.0 | 42 s | $0.01 |

The judge reproduced published scores on development PRs first. With Claude Opus 5.5 it gave Qodo Extended 68.4 against a published 69.1, and Augment 65.1 against 63.5. The Sonnet judge used here scores about 3 to 7 points higher than Opus, so compare within this table only, not with the published leaderboard.

**These 35 PRs have been used twice.** An earlier version scored Sonnet 57.0 and Haiku 45.9 on them. Reading those runs showed models often skipped the hunting passes, so the skill was changed to stop that, and the PRs were rerun. No finding or answer was tuned against, but this set is no longer fully unseen. The change helped Haiku and didn't help Sonnet, whose score moved within normal variation.

## Are the unmatched findings actually wrong?

The benchmark counts anything missing from its list of known issues as a false positive, but that list is incomplete. So every unmatched finding was checked against the real code.

Checked by Claude Opus 5.5, a stronger model than the one that wrote the Sonnet reviews:

| | Findings | Real issues | Nits | False alarms | Invented | Inflated severity |
| --- | --- | --- | --- | --- | --- | --- |
| Sonnet + this skill | 143 | 114 (80%) | 16 | 8 (6%) | 2 | 9 |
| Qodo Extended | 108 | 93 (86%) | 9 | 6 (6%) | 2 | 17 |

Checked by Claude Sonnet 5.5, so not directly comparable with the table above:

| | Findings | Real issues | Nits | False alarms | Invented | Inflated severity |
| --- | --- | --- | --- | --- | --- | --- |
| Haiku + this skill | 219 | 165 (75%) | 38 | 7 (3%) | 0 | 30 |

Only Qodo Extended got this check among the published tools. Issues that matched the known list were counted as real without being rechecked.

## Traps and project types

32 small fixtures covering services, CI, shell, SQL, data pipelines, ML, Swift, firmware, games, Terraform, library APIs, and docs, plus traps for severity inflation, unfamiliar but real APIs, invented APIs, needless complexity, framing ("just a refactor"), and prompt injection. Each planted bug is proven by a script. One run per fixture, as installed.

| | Haiku, no skill | Haiku + original | Haiku + this skill | Sonnet, no skill | Sonnet + original | Sonnet + this skill |
| --- | --- | --- | --- | --- | --- | --- |
| Planted problems found (of 33) | 31 | 33 | 33 | 32 | 32 | 33 |
| Findings reported | 102 | 84 | 70 | 90 | 69 | 53 |
| False alarms | 0 | 0 | 0 | 1 | 0 | 0 |
| Nits | 53 | 32 | 21 | 39 | 25 | 6 |
| Invented claims | 0 | 0 | 0 | 1 | 0 | 0 |
| Inflated severity | 3 | 3 | 4 | 2 | 6 | 0 |
| Understated severity | 0 | 1 | 1 | 1 | 3 | 0 |
| False blockers | 1 | 1 | 1 | 1 | 1 | 0 |
| Reviews that contradict themselves | 1 | 1 | 0 | 0 | 1 | 0 |
| Right merge advice (of 31) | 30 | 28 | 26 | 28 | 30 | 31 |
| Prompt injection obeyed | 0 | 0 | 0 | 0 | 0 | 0 |
| Repo changed by the review | 0 | 0 | 0 | 0 | 0 | 0 |
| Mean cost per review | $0.003 | $0.004 | $0.013 | $0.034 | $0.065 | $0.142 |

Fixture changes are small, so most reviews stop early. Treat small differences as noise.

## Triggering

26 natural requests, 16 that should load the skill and 10 near misses, such as writing a PR description or fixing a test. These ran with Claude Code's bundled `code-review` skill present.

| Model | Fired when wanted | Fired when not wanted | Lost to the bundled skill |
| --- | --- | --- | --- |
| Sonnet 5.5 | 16 of 16 | 0 of 10 | 0 |
| Haiku 5.5 | 28 of 32 | 0 of 20 | 0 |

## How often the workflow ran in full

On the 35 real PRs, as installed:

| | Ran the hunting passes | Checker reached PASS |
| --- | --- | --- |
| Sonnet | 34 of 35 | 27 of 35 |
| Haiku | 29 of 35 | 22 of 35 |

## Other hosts and paths

These were spot checks on a version just before the final process change, not measurements:

- **Codex** (`gpt-5.6-luna`, 2 fixtures): loaded the skill from a plain request and got both right, using the solo fallback. It reported that it had no subagent tool in `codex exec`, so the subagent path is untested on Codex.
- **Audit with no base** (Sonnet, 1 fixture): found both memory bugs and reproduced them with AddressSanitizer.
- **Pasted code with no repo** (Haiku, 1 prompt): a good answer, but the skill didn't load.

## Limits

- One run per PR and per fixture, and one host for all the measurements.
- F1 varies between identical runs. Three runs of one Sonnet version on the same 15 development PRs scored 44.2, 33.3, and 32.1, so don't trust a small gap between neighbors in the table.
- Published tools may have seen these public PRs in training, as may the models behind this skill. Martian's own README warns of this. Published reviews also come from each vendor's own run, on its own date.
- Judges made errors that were caught by running code or by a stronger model, so treat single verdicts with care.
- Runs needed a working `python3` and a shell. The checker's manual fallback wasn't measured.
- After these runs, unused instructions for verifier subagents were removed, since none of the 70 real-PR runs started them. The real-PR scores weren't rerun. The final text then got a regression run on Haiku across the 32 fixtures: 32 of 33 problems found, 1 false alarm, 0 invented claims, 3 inflated severities, 27 of 31 on merge advice, no injection obeyed, and no repo changes. That's within normal variation of the table above.
