# Review Receipts

**Code reviews that show their receipts.**

A code review skill for AI agents, designed for any language or kind of project. It checks each finding against the code before reporting it, gives each one a severity based on what would actually go wrong, and says plainly when the code is fine. It was tested on Python, Go, TypeScript, Ruby and Java pull requests, plus small test changes in other languages.

```markdown
**Verdict: Don't merge yet.** A retry can charge a customer twice.

## Must fix

### 1. A timed-out charge is retried without an idempotency key (`billing/service.py:15`, Confirmed)
What goes wrong: a gateway timeout can follow a successful capture, so the retry charges the customer again.
Evidence: `return gateway.charge(order.customer_id, order.amount_cents)`. A simulated timeout after capture produced two charges.
Fix: pass a stable key, such as the order id, on every attempt.

**Checked:** ran the tests and simulated both failure paths. **Not checked:** nothing relevant. 1 minor point omitted; ask to see it.
```

## Install

```sh
npx skills add yourcodebuddy-in/skills --skill review-receipts
```

Then ask in plain words, such as "review this branch" or "is this OK to merge?". The skill's name, `review-receipts`, doesn't replace Claude Code's bundled `code-review`, which stays available as `/code-review`.

**Requirements:** git and a shell for reviewing changes, and Python 3 for the checker, with a manual fallback if it's missing. It works best on hosts that can start subagents. Otherwise it makes the passes itself.

## How it works

Most review mistakes have a mechanical cause, so the skill tackles them mechanically:

| Problem | What the skill does |
| --- | --- |
| Bugs get missed at random | Three independent hunting passes that can't see each other. On 15 development PRs, combining three separate Haiku reviews raised the share of known issues found from 47% to 70%, not counting false positives |
| Wrong findings | A verification step tries to disprove each suspicion by reading the code. Then a fresh subagent that didn't raise the findings tries to refute them |
| Invented code or APIs | A script checks every cited line against the real file, and claims about an API must be checked rather than remembered |
| Skipped steps | The same script rejects submitted notes if a changed file or suspicion isn't accounted for. It only helps when it runs: in testing of 1.0.0, runs reached its PASS on 27 of 35 PRs on Sonnet and 22 of 35 on Haiku |
| Minor issues treated as deal breakers | Severity comes from one question: if this merged today and nobody touched it for a month, what exactly goes wrong, and for whom? |
| Contradictory verdicts | The verdict follows a fixed rule based on the findings |
| Overbuilt fixes | Each fix is the smallest change that removes the cause |
| Noise | Minor points are counted but not listed, and you can ask to see them |
| Prompt injection in the code under review | Everything under review is treated as data, and project rules are read from the base branch |
| Code under review that deletes files | It runs code only in a throwaway copy, with its home folder and paths inside a temp directory, and traces anything it can't confine that way |

## Results

Version 1.0.0 was measured on 35 real pull requests kept out of development, though the skill was revised once after reading its runs on them. Each row is one run per PR, scored by one judge. See [evals/review-receipts/RESULTS.md](../../evals/review-receipts/RESULTS.md) for the method, the full tables, and the limits.

| On 35 real PRs | Recall | F1 | Reported cost per PR |
| --- | --- | --- | --- |
| Qodo Extended, the top of the 8 published tools we scored | 60.0 | 61.9 | |
| Sonnet + this skill | 61.7 | 55.0 | $0.33 |
| Haiku + this skill | 74.8 | 51.5 | $0.08 |
| Sonnet, no skill | 69.6 | 47.3 | $0.11 |
| Claude Code (CLI, as Martian names it) | 41.7 | 45.5 | |
| Haiku, no skill | 67.8 | 40.2 | $0.01 |

That judge was Claude Sonnet, which also wrote the Sonnet reviews and favored them. Regraded by Claude Opus, which wrote none of them, the gap is wider:

| On the same 35 PRs, graded by Opus | Precision | Recall | F1 |
| --- | --- | --- | --- |
| Qodo Extended | 61.9 | 60.9 | 61.4 |
| Cubic | 62.2 | 60.0 | 61.1 |
| Sonnet + 1.0.0 | 41.6 | 58.3 | 48.6 |
| Sonnet + 1.1.0 | 47.8 | 47.8 | 47.8 |
| Opus + 1.1.0 | 41.5 | 53.0 | 46.6 |
| Opus, no skill | 30.2 | 79.1 | 43.8 |
| Haiku + 1.1.0 | 36.8 | 49.6 | 42.2 |
| Sonnet, no skill | 28.7 | 67.0 | 40.2 |

The skill adds about 8 points to Sonnet, and 1.1.0 trades recall for precision with about the same F1 as 1.0.0. Both trail the leaders by about 13 points. Opus doesn't close the gap: alone it found more known issues than any tool but with many false positives, and the skill's filtering removed real issues nearly as often as false ones. Opus graded its own model's reviews in those rows, which may favor them.

F1 counts anything missing from the benchmark's list of known issues as wrong, but that list is incomplete. Checked against the real code by a stronger model, the same reviews compare like this:

| | Real issues found | False alarms | Invented |
| --- | --- | --- | --- |
| Sonnet + this skill | 116 of 145 | 8 | 2 |
| Qodo Extended | 93 of 108 | 6 | 2 |

Only Qodo Extended got this deeper check among the published tools, and Qodo's findings were more often real (86% vs. 80%). On 32 small test changes across many project types, Sonnet with the skill found all 33 planted problems, with no false alarms, invented claims, or inflated severity, in one run each. Those test changes were also used during development, so treat that as a check, not a score.

**A later test found more false alarms.** On 35 newer PRs from 35 other projects, Claude Opus judged 18% of the Sonnet findings and 15% of the Haiku findings to be false alarms, against the 6% above. Only 65% of Sonnet's findings and 37% of Haiku's were real issues. Expect these higher figures on your own code. See [the fresh test results](../../evals/review-receipts/FRESH-TEST-RESULTS.md).

**Version 1.1.0 was compared with 1.0.0 on another 35 fresh PRs,** under rules written in advance, and passed on both models. It wasn't rerun on the benchmark above. One run per PR, with findings outside the answer key checked by Claude Opus:

| On 35 fresh PRs | Findings | Real issues | False alarms | Invented | Known defects found |
| --- | --- | --- | --- | --- | --- |
| Sonnet + 1.0.0 | 46 | 32 | 6 (13%) | 2 | 22 to 25 of 68 |
| Sonnet + 1.1.0 | 39 | 33 | 1 (3%) | 0 | 22 to 23 of 68 |
| Haiku + 1.0.0 | 133 | 50 | 22 (17%) | 6 | 32 of 68 |
| Haiku + 1.1.0 | 69 | 38 | 11 (16%) | 3 | 20 of 68 |

Known defects are counted against an answer key corrected after the test, since the first one also counted fixes to code added after the review. Ranges show where two gradings of the same reviews differed. On Sonnet, 1.1.0's gain is fewer false alarms, not more defects found. On Haiku, 1.1.0 trades recall for fewer findings. On the small test changes, Sonnet with 1.1.0 found 32 of 33 planted problems and gave the right merge advice on 26 of 31, against 33 and 31 for 1.0.0, in one run each. See [the second fresh test results](../../evals/review-receipts/FRESH-TEST-2-RESULTS.md).

## Choosing a model

The main agent's model sets the tradeoff. Either way, the hunting passes run on the cheapest model available.

- **A mid-tier model such as Sonnet** gives cleaner reports and better merge advice. On fresh PRs, 1.1.0 reported about 1 issue per PR, and Opus judged 3% of them false alarms.
- **A cheap model such as Haiku** costs about a quarter as much. On fresh PRs, 1.1.0 reported about 2 issues per PR, with 16% judged false alarms, and found fewer of the known defects than Sonnet or than Haiku with 1.0.0. Plan to read those reports critically.

A review takes longer than a single pass, at about three minutes per PR in testing, and uses more tokens. Trivial changes take one short pass.

## How it was measured

[docs/BENCHMARKING.md](../BENCHMARKING.md) explains the method, and [evals/review-receipts/](../../evals/review-receipts/) holds the test suite: 32 fixtures with proven bugs across many project types, plus the real-PR benchmark.

## Credits

The real-PR test set comes from [Martian's Code Review Bench](https://github.com/withmartian/code-review-benchmark) (MIT). [Cursor](https://cursor.com/blog/building-bugbot) also reported using multiple passes in Bugbot's launch version. Leaving out minor points draws on [Google's code review guide](https://google.github.io/eng-practices/review/) and its "Nit:" convention, and [Conventional Comments](https://conventionalcomments.org/) labels comments as blocking or non-blocking.
