# Changelog

Each skill has its own version, set in its `SKILL.md`.

## audit-receipts 0.1.1

- The default bar's points on money and docs are tied to actual harm. A wrong figure that's only displayed, while the right one is charged or stored, is `high` at most. A default or limit that differs from the docs is `medium`, or `high` if users will rely on it.
- Ratings follow the context the project states, such as a part documented as a stand-in for development or a rule to run one worker.
- A product choice the project made is a decision to question with evidence, not a defect.
- A test that would still pass with its code broken is a `medium` example, and the reviewer's question on tests names mocks and stubs.

On a new unseen fixture it passed the release rules set before the run, against 0.1.0, but every difference was within what two runs of one version vary by. See [the results](evals/audit-receipts/RESULTS.md).

## audit-receipts 0.1.0

First release. See [its page](docs/skills/audit-receipts.md) for how it works and how it scored, and [the results](evals/audit-receipts/RESULTS.md) for what it wasn't tested on.

## review-receipts 1.1.0

- Code from the change runs only in a throwaway copy inside a temp directory, with `HOME` and every path it uses pointed there. Anything that deletes or moves files and can't be confined that way is traced instead of run.
- A fresh subagent tries to refute every finding before the report is written.
- The verification rules moved into `SKILL.md`. They require a real path to the code, a search before claiming something is missing, and outside facts to be checked or dropped.
- Reports keep at most one question, list a pre-existing bug only if it would be a Must fix were it new, and count minor points without describing them.
- The description says what the skill does rather than promising results.

On 35 fresh PRs against 1.0.0, Claude Opus judged 3% of Sonnet's findings false alarms, down from 13%, and 16% of Haiku's, down from 17%. Haiku reported half as many findings but found 19 of 88 known defects, against 30. A corrected answer key later gave 20 of 68 against 32 on Haiku, and about the same number for both versions on Sonnet. See [the results](evals/review-receipts/FRESH-TEST-2-RESULTS.md).

## review-receipts 1.0.0

First release. See [its page](docs/skills/review-receipts.md) for how it works and how it scored.
