# Changelog

Each skill has its own version, set in its `SKILL.md`.

## review-receipts 1.1.0

- Code from the change runs only in a throwaway copy inside a temp directory, with `HOME` and every path it uses pointed there. Anything that deletes or moves files and can't be confined that way is traced instead of run.
- A fresh subagent tries to refute every finding before the report is written.
- The verification rules moved into `SKILL.md`. They require a real path to the code, a search before claiming something is missing, and outside facts to be checked or dropped.
- Reports keep at most one question, list a pre-existing bug only if it would be a Must fix were it new, and count minor points without describing them.
- The description says what the skill does rather than promising results.

On 35 fresh PRs against 1.0.0, Claude Opus judged 3% of Sonnet's findings false alarms, down from 13%, and 16% of Haiku's, down from 17%. Haiku reported half as many findings but found 19 of 88 known defects, against 30. A corrected answer key later gave 20 of 68 against 32 on Haiku, and about the same number for both versions on Sonnet. See [the results](evals/review-receipts/FRESH-TEST-2-RESULTS.md).

## review-receipts 1.0.0

First release. See [its page](docs/skills/review-receipts.md) for how it works and how it scored.
