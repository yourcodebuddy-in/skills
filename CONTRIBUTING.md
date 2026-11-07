# Contributing

## Add a skill

1. Copy `template/SKILL.template.md` to `skills/<name>/SKILL.md`. The folder name and the `name` field must match, using lowercase letters, numbers, and hyphens.
2. Add its test suite in `evals/<name>/`, and record what it showed in `evals/<name>/RESULTS.md`. [docs/BENCHMARKING.md](docs/BENCHMARKING.md) explains the method.
3. Add a page at `docs/skills/<name>.md`, and a row in the README's skill table.
4. Add an entry to `CHANGELOG.md`.
5. Run `node scripts/check-skills.mjs`.

## Rules for every skill

- **It stands alone.** People install one skill at a time, so don't refer to other skills or to files outside its folder.
- **It works for any project.** Don't assume a language, a framework, or this repo. Use examples from more than one kind of project.
- **It stays small.** The installer copies the whole folder to users, so tests, fixtures, and benchmark data go in `evals/<name>/`. Keep `SKILL.md` under 500 lines and about 5,000 tokens, and move long reference material to `references/`.
- **It works without a specific host.** Name a host's tool only as an example, and say what to do where it isn't available.
- **Its claims are measured.** Say how a number was produced, and publish weak results as plainly as strong ones.

## Change a skill

Measure the change before and after, as described in [docs/BENCHMARKING.md](docs/BENCHMARKING.md), and tune only on development data. Then raise `metadata.version` in the skill's frontmatter, update its results, and add a `CHANGELOG.md` entry.

A skill's name is permanent once released, because people install it by name.

## Keep the skill list flat until it hurts

Skills live directly in `skills/<name>/`. Some large collections group them, as in `skills/engineering/<name>/`, and the skills CLI finds both. Consider groups only once the list is too long to scan, because moving a skill changes its path.
