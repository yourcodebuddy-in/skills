# Fresh test plan

Written on 2026-11-07, before any PR was selected or any result was seen. It fixes the method and what counts as success, so that the outcome can't be bent afterward. If anything below has to change, the change and its reason get recorded here.

## Question

Is the candidate better than `review-receipts` 1.0.0 on pull requests that neither version was developed against? The candidate has at most one question per report, lists pre-existing bugs only if they'd be a Must fix were they new, and gives only a count of minor points.

## The pull requests

Selected by `prepare-fresh-prs.mjs` with these fixed rules:

- Merged between 2026-08-01 and 2026-10-31 in public, non-fork repositories with at least 500 stars.
- Reviewed by at least one AI review bot, so published tools can be compared on the same PRs.
- 40 to 1,000 changed lines across at most 40 files, not written by a bot.
- At most one PR per repository, and none from Sentry, Grafana, Cal.com, Discourse, or Keycloak, which were used in development.
- A commit exists from before the first review, which is the version under review.
- Target of 35 PRs: 28 with code commits after the first review and 7 without, the latter being a test of false alarms on changes that needed no follow-up. Languages are balanced by taking turns across them.
- Order within each group comes from a hash of the PR's id and the fixed seed `fresh-2026-11-07`, so the choice can't be influenced.

Any PR that can't be built into a local repo, including repos over about 2 GB, gets replaced by the next in order, and is recorded.

Candidates come from GitHub searches by bot, language, and month, using the bot names from Martian's online benchmark and up to 100 results per search, sorted by most recently updated. Search results are limited, so this samples PRs and doesn't cover all of them. At most 3 PRs per repository go forward to the rule checks.

## The answer key

For each PR, a judge (Claude Opus 5.5) reads the later commits, with their diffs, and lists the defects those commits fixed. Features, refactors, style, and merges from the base branch don't count.

Limits of this key: it's only what developers chose to fix, and some fixes were prompted by a bot's comment, which favors that bot in a comparison. So findings it doesn't contain aren't counted as wrong without being checked.

## What gets run

One run per PR for each of `no_skill`, `prev_skill` (1.0.0), and `with_skill` (the candidate), on Sonnet and on Haiku. The skill stays frozen for the whole test.

- **Scoring:** a judge (Claude Sonnet 5.5) matches each report to the answer key, as in the earlier benchmark.
- **False findings:** a judge (Claude Opus 5.5) checks every finding not in the answer key against the code, for `prev_skill` and `with_skill` on both models.
- **Published tools:** bot comments already on these PRs, from before the first human fix where possible, are scored with the same judge. Each bot only reviewed some PRs, so each comparison uses that bot's PRs only.

## What counts as success

Decided in advance, with false findings first. The candidate replaces 1.0.0 only if all of these hold on both models:

1. **False-alarm rate** (wrong findings divided by all findings) is no higher than 1.0.0's.
2. **Invented claims** are no more than 1.0.0's.
3. **Real issues found** (findings matching the answer key plus unmatched findings judged valid) don't fall by more than 25%.

If only some hold, or if the results don't separate the two versions, the candidate doesn't ship as an improvement, and the report says so.

One run per PR can't prove a small difference. Whichever way this goes, it will be reported with its limits, and these PRs then count as used.

## Rules while running

- No change to the skill between selecting PRs and finishing the runs.
- The answer key isn't read before the runs, except a spot check of a few entries from PRs chosen at random, to confirm the key is sound. Any entry checked this way is recorded.
- All results get published, whichever way they go.

## Record

- **PRs that couldn't be built, and were replaced by reserves:** `frappe/erpnext` #61823, `project-chip/connectedhomeip` #73251, and `code-dot-org/code-dot-org` #76408 (repos over about 2 GB); `modelcontextprotocol/php-sdk` #638 (its patch didn't apply); `Luce-Org/lucebox` #904 (couldn't be extracted).
- **Replaced because no answer key could be made:** `rapid7/metasploit-framework` #21837. The judge returned no result on two attempts, most likely because it's an exploit framework. The next reserve took its place.
- **Removed from PR descriptions before any run:** blocks written by CodeRabbit, cubic, Cursor, and Codesmith, because bots can add them after the first review, so they could hint at what's wrong. Descriptions are otherwise the final version, because GitHub doesn't keep the version from the first review, and one still mentions which bots' checks passed. A description edited later by a person could still hint at a fix, and that applies to every configuration equally.
- **Answer key read before the runs:** up to 3 entries each from `ArcadeData/arcadedb` #10257, `assistant-ui/assistant-ui` #5313, and `koala73/worldmonitor` #9905, chosen at random with a fixed seed. The entries described specific defects tied to the commits that fixed them.
- **Outcome:** the candidate failed rules 1 and 2 on both models and doesn't replace 1.0.0. See [FRESH-TEST-RESULTS.md](FRESH-TEST-RESULTS.md).
