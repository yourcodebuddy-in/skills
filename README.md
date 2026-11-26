# Agent Skills

Agent skills built to work on any project and measured before release. Each one is a plain [Agent Skills](https://agentskills.io) folder, which any agent that supports the format can load. Each skill's results say which agents it was actually tested on.

## Skills

| Skill | What it does | Details |
| --- | --- | --- |
| [review-receipts](skills/review-receipts/SKILL.md) | Reviews code and checks each finding against the code before reporting it, with a severity based on what would actually go wrong | [Docs and results](docs/skills/review-receipts.md) |
| [audit-receipts](skills/audit-receipts/SKILL.md) | Audits a whole codebase, reading every file, checks each finding against the code, and scores each area with the reasons behind every point lost | [Docs and results](docs/skills/audit-receipts.md) |

### How review-receipts was tested

Version 1.0.0 was tested on 35 real pull requests from Sentry, Grafana, Cal.com, Discourse and Keycloak, using Martian's open Code Review Bench and our own judge, with one run per PR. These PRs were kept out of development, though the skill was revised once after reading its runs on them.

| | With no skill | With review-receipts |
| --- | --- | --- |
| Sonnet: overall score (F1) | 47.3 | 55.0 |
| Sonnet: issues reported per PR | 6.5 | 4.1 |
| Haiku: overall score (F1) | 40.2 | 51.5 |
| Haiku: known issues found | 67.8% | 74.8% |

Of the 8 published tools we scored with the same judge, the top one scored 61.9, so this isn't the leader on overall score. That judge was Claude Sonnet, which also wrote the Sonnet reviews and favored them. Regraded by Claude Opus, Sonnet with 1.0.0 scored 48.6, Sonnet with 1.1.0 scored 47.8, and Sonnet with no skill 40.2, against 61.4 for the top tool, Qodo Extended. So the skill helps, but trails the leaders by about 13 points. A stronger reviewer didn't close the gap: Opus with 1.1.0 scored 46.6, and Opus alone 43.8. [Full results, limits and method](evals/review-receipts/RESULTS.md).

**A later test found more false alarms.** On 35 newer PRs from 35 other projects, with one run per PR, 1.0.0 scored higher than no skill on Haiku (F1 30.6 vs. 19.4), and about the same on Sonnet (31.0 vs. 29.3, within the judge's own variation). These use an answer key corrected after the test, because the first one also counted fixes to code added after the review. But Claude Opus judged 18% of its Sonnet findings and 15% of its Haiku findings to be false alarms, well above the 6% measured on Sonnet in the table's test. Expect the higher figure on your own code. [Fresh test results](evals/review-receipts/FRESH-TEST-RESULTS.md).

**Version 1.1.0 was compared with 1.0.0 on another 35 fresh PRs,** under rules written in advance, and passed on both models. Opus judged 3% of the Sonnet findings to be false alarms, against 13% for 1.0.0. On Haiku it was 16% against 17%, but Haiku also found fewer of the known defects, 20 of 68 against 32 on the corrected key. On Sonnet both versions found about the same number, 22 to 25 of 68. On the benchmark above, 1.1.0 and 1.0.0 scored about the same. [Second fresh test results](evals/review-receipts/FRESH-TEST-2-RESULTS.md).

### How audit-receipts was tested

Each version is tested on a project with 12 proven planted problems, built by an agent that never saw the skill's development runs, with Claude Sonnet auditing and Claude Opus judging. Version 0.1.1 was tested on a 3,945-line Node service, with two runs each:

| | With no skill | 0.1.0 | 0.1.1 |
| --- | --- | --- | --- |
| Planted problems found | 20 of 24 | 22 of 24 | 21 of 24 |
| Other real problems found | 13 | 68 | 62 |
| False alarms or invented code | 1 | 0 | 0 |
| Files opened | 95% | 100% | 100% |
| Time and cost per audit | 1.5 min, $0.47 | 9.9 min, $6.06 | 10.6 min, $5.92 |

All three found all 6 problems at the release bar, so the skill's gain is in the rest, at more than 10 times the cost. 0.1.1 passed the rules set before the run to replace 0.1.0, but isn't shown to be better. The projects tested were small, at 2,700 to 6,000 lines. [Full results, limits and method](evals/audit-receipts/RESULTS.md).

## Install

Install one skill:

```sh
npx skills add yourcodebuddy-in/skills --skill review-receipts
```

Or choose from a list:

```sh
npx skills add yourcodebuddy-in/skills
```

This uses the open [skills CLI](https://github.com/vercel-labs/skills), which needs Node 22.20 or later. Add `-g` to install for all your projects. To install by hand, copy a folder from `skills/` into your agent's skills folder, such as `.claude/skills/` or `.agents/skills/`.

Each skill stands alone, so you only need the ones you want.

## Repo layout

```text
skills/<name>/          What users install. Copied whole, so it stays small
evals/<name>/           How that skill is measured, with its results. Never installed
docs/skills/<name>.md   The skill's page for people
docs/BENCHMARKING.md    How we measure skills, and what we learned
template/               Starting point for a new skill
scripts/                Repo checks
workspace/              Local run data. Git-ignored
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to add or change a skill.

## License

[MIT](LICENSE). Third-party notices are in [NOTICE.md](NOTICE.md).
