# Tools

Tools are cheap and find things reading misses, but their output is a lead, not a finding. Every result goes through verification like any other finding.

## Run the project's own checks first

Find what the project already runs, and run it the same way:

- CI config, such as `.github/workflows/`, `.gitlab-ci.yml`, or `Jenkinsfile`
- task files, such as `package.json` scripts, `Makefile`, `justfile`, `Taskfile.yml`, `pyproject.toml`, `tox.ini`, or `noxfile.py`
- pre-commit hooks and lint configs

Use the project's pinned versions from its lockfile and its own task runner. A check that fails only on your machine, for example because of untracked local files or a missing service, is a `GAP` with its reason, not a finding.

## Then cover each category

Use what the project has, or a widely used tool for its language. Tools that must be downloaded reach the network, so say so before running them.

| Category | Examples |
| --- | --- |
| Types and lint | `tsc`, ESLint, oxlint, Biome; mypy, pyright, ruff; `go vet`, staticcheck; clippy; SpotBugs, detekt; RuboCop; PHPStan; Roslyn analyzers |
| Tests and coverage | the project's test command; coverage only if it's already set up |
| Vulnerable dependencies | `npm`/`pnpm audit`, pip-audit, govulncheck, cargo-audit, OWASP Dependency-Check, bundler-audit, `composer audit`, `dotnet list package --vulnerable`; OSV-Scanner for any |
| Secrets | gitleaks, TruffleHog |
| Static security analysis | Semgrep, CodeQL; bandit, gosec, Brakeman |
| Dead code | knip, ts-prune; vulture; `deadcode` for Go; cargo-machete; debride |
| Duplication | jscpd, PMD CPD |
| Size and complexity | scc, lizard |
| History | `git log` churn per file, recent bug-fix commits, files only one person ever changed |

## Reading the results

- Dead-code tools miss dynamic use, framework conventions, aliases and config. Search the repo before treating anything as unused.
- Duplication tools find exact copies. The costly duplication is usually near-copies of one rule, which reviewers find by reading.
- A clean result is worth recording too, such as "no known vulnerabilities" or "0.4% duplication", because it supports the scores.
