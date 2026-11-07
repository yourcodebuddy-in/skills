# Agent Skills

Agent skills built to work on any project and measured before release. Each one is a plain [Agent Skills](https://agentskills.io) folder, which any agent that supports the format can load. Each skill's results say which agents it was actually tested on.

## Skills

| Skill | What it does | Details |
| --- | --- | --- |
| [review-receipts](skills/review-receipts/SKILL.md) | Reviews code and checks each finding against the code before reporting it, with a severity based on what would actually go wrong | [Docs and results](docs/skills/review-receipts.md) |

### How review-receipts was tested

Tested on 35 real pull requests from Sentry, Grafana, Cal.com, Discourse and Keycloak, using Martian's open Code Review Bench and our own judge, with one run per PR. These PRs were kept out of development, though the skill was revised once after reading its runs on them.

| | With no skill | With review-receipts |
| --- | --- | --- |
| Sonnet: overall score (F1) | 47.3 | 55.0 |
| Sonnet: issues reported per PR | 6.5 | 4.1 |
| Haiku: overall score (F1) | 40.2 | 51.5 |
| Haiku: known issues found | 67.8% | 74.8% |

Of the 8 published tools we scored with the same judge, the top one scored 61.9, so this isn't the leader on overall score. [Full results, limits and method](evals/review-receipts/RESULTS.md).

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
