# Agent Skills

Agent skills that work on any project and are measured before they're trusted. Each one is a plain [Agent Skills](https://agentskills.io) folder, so it works with Claude Code, Codex, Cursor, and other agents that support the format.

## Skills

| Skill | What it does | Details |
| --- | --- | --- |
| [review-receipts](skills/review-receipts/SKILL.md) | Reviews code and reports only findings it has checked against the code, with a severity based on what would actually go wrong | [Docs and results](docs/skills/review-receipts.md) |

### How review-receipts was tested

Tested on 35 real pull requests from Sentry, Grafana, Cal.com, Discourse and Keycloak, using Martian's open Code Review Bench.

| | With no skill | With review-receipts |
| --- | --- | --- |
| Sonnet: overall score (F1) | 47.3 | 55.0 |
| Sonnet: issues reported per PR | 6.5 | 4.1 |
| Haiku: overall score (F1) | 40.2 | 51.5 |
| Haiku: known issues found | 67.8% | 74.8% |

The top published tool scored 61.9, so this isn't the leader on overall score. [Full results, limits and method](evals/review-receipts/RESULTS.md).

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
