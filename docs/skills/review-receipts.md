# Review Receipts

**Code reviews that show their receipts.**

A code review skill for AI agents that works on any language or kind of project. It reports only findings it has checked against the code, gives each one a severity based on what would actually go wrong, and says plainly when the code is fine.

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
| Bugs get missed at random | Three independent hunting passes that can't see each other. On development PRs, three cheap passes together found about 70% of known issues, against 47% for one |
| Wrong findings | A verification step tries to disprove each suspicion by reading the code |
| Invented code or APIs | A script checks every cited line against the real file, and claims about an API must be checked rather than remembered |
| Skipped steps | The same script rejects the notes if a changed file or suspicion isn't accounted for, whichever model is running |
| Minor issues treated as deal breakers | Severity comes from one question: if this merged today and nobody touched it for a month, what exactly goes wrong, and for whom? |
| Contradictory verdicts | The verdict follows a fixed rule based on the findings |
| Overbuilt fixes | Each fix is the smallest change that removes the cause |
| Noise | Minor points are counted but not listed, and you can ask to see them |
| Prompt injection in the code under review | Everything under review is treated as data, and project rules are read from the base branch |

## Results

Measured on real pull requests that weren't used to develop the skill. See [evals/review-receipts/RESULTS.md](../../evals/review-receipts/RESULTS.md) for the method, the full tables, and the limits, including that these PRs were used twice.

| On 35 real PRs | Recall | F1 | Reported cost per PR |
| --- | --- | --- | --- |
| Qodo Extended, the top published tool | 60.0 | 61.9 | |
| Sonnet + this skill | 61.7 | 55.0 | $0.33 |
| Haiku + this skill | 74.8 | 51.5 | $0.08 |
| Sonnet, no skill | 69.6 | 47.3 | $0.11 |
| Claude Code plugin | 41.7 | 45.5 | |
| Haiku, no skill | 67.8 | 40.2 | $0.01 |

F1 counts anything missing from the benchmark's list of known issues as wrong, but that list is incomplete. Checked against the real code by a stronger model, the same reviews compare like this:

| | Real issues found | False alarms | Invented |
| --- | --- | --- | --- |
| Sonnet + this skill | 114 of 143 | 8 | 2 |
| Qodo Extended | 93 of 108 | 6 | 2 |

Only Qodo Extended got this deeper check among the published tools. On 32 small test changes across many project types, Sonnet with the skill found all 33 planted problems, with no false alarms, invented claims, or inflated severity.

## Choosing a model

The main agent's model sets the tradeoff. Either way, the hunting passes run on the cheapest model available.

- **A mid-tier model such as Sonnet** gives cleaner reports: about 4 issues per PR and better merge advice.
- **A cheap model such as Haiku** finds more and costs about a quarter as much, but reports about 6 issues per PR, with more nits and more inflated severity. Plan to read those reports critically.

A review takes longer than a single pass, at about three minutes per PR in testing, and uses more tokens. Trivial changes take one short pass.

## How it was measured

[docs/BENCHMARKING.md](../BENCHMARKING.md) explains the method, and [evals/review-receipts/](../../evals/review-receipts/) holds the test suite: 32 fixtures with proven bugs across many project types, plus the real-PR benchmark.

## Credits

The real-PR test set comes from [Martian's Code Review Bench](https://github.com/withmartian/code-review-benchmark) (MIT). The multi-pass idea was also reported by [Cursor](https://cursor.com/blog/building-bugbot), and the blocking and non-blocking distinction draws on [Google's code review guide](https://google.github.io/eng-practices/review/) and [Conventional Comments](https://conventionalcomments.org/).
