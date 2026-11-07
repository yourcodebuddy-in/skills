# Fixing findings

Use this only when asked to make fixes. Change only the findings you were asked to fix.

## Before editing

- State what must change and what must stay the same.
- Find where the broken rule is owned, and read its callers, tests, and stored data.
- Keep existing uncommitted work, and follow the repo's own instructions.

## Fix the cause

- Make the smallest change that fixes the shared cause. A tiny patch at the wrong layer isn't small if every caller stays broken.
- Reuse the standard library, installed dependencies, and existing project code before adding anything.
- Leave out new interfaces, factories, options, and helpers unless there's a second use today.
- Leave unrelated code alone. Report anything else you notice instead of fixing it.
- Keep the check that exposed the problem. Weakening types, validation, tests, lint rules, permissions, or error reporting to get a pass isn't a fix. Neither are casts, suppressions, broad catches, sleeps, or retries that hide it.
- Validate untrusted values where they enter.

## Existing data and old callers

Old code or data alone doesn't mean backward compatibility is needed. Check whether a public consumer, stored format, or rolling deploy requires it. If a new form should be the only one, migrate existing data, update producers and consumers, then delete the old path. If temporary compatibility is required, keep it at one boundary and state when it can go.

## Verify

1. Reproduce the failure before fixing when you can. Prefer a regression test that fails before the fix.
2. Run the relevant tests and any checks the repo requires.
3. Try to delete or inline anything the fix added without changing behavior.
4. Rerun the original failing case to show it's resolved.
5. Review the final diff as a new change, ignoring your own reasoning. Trace changed inputs, outputs, errors, and callers for anything the fix broke.

Report each finding as resolved, unresolved, or unverified, and report any new problem with the same ratings as the review.
