# Fixing admitted findings

Use this reference only when the user explicitly asks to implement fixes.

## Before editing

- Restate the behavior that must change and the behavior that must remain untouched.
- Locate the authoritative owner of the broken invariant and inspect its callers, consumers, tests, and persisted effects.
- Estimate the natural scope of the correction. If the diff grows beyond it, stop and check whether unrelated cleanup, speculative design, or compatibility work entered the solution.
- Preserve existing worktree changes and follow the repository's own instructions and established contracts.

## Implement the cause, not the proxy

- Make the smallest change that fixes the shared cause. A tiny patch at the wrong layer is not minimal if every caller remains vulnerable.
- Reuse the standard library, platform, installed dependencies, and current project infrastructure before adding code or packages.
- Do not introduce an interface, factory, registry, configuration option, generic helper, or state copy without a current second need.
- Do not refactor, rename, reformat, document, or harden unrelated code. Report unrelated observations separately only when material.
- Never silence the mechanism that exposed the problem unless changing that mechanism is the task. Do not weaken types, validation, schemas, tests, assertions, lint rules, security checks, permissions, CI, or error reporting to obtain a passing result.
- Do not use casts, suppressions, broad exception handling, magic fallbacks, hardcoded cases, sleeps, retries, or mocks to hide an unproved invariant.
- Validate untrusted values at the boundary where they enter. A type annotation does not establish runtime truth.

## Converge representations

Do not infer backward compatibility merely because old code or data exists. Determine whether a public consumer, stored format, rolling deployment, or explicit contract requires it.

When the new representation should be canonical:

1. migrate or backfill existing state;
2. update internal producers and consumers;
3. strengthen the authoritative contract;
4. delete obsolete fields, branches, writes, adapters, and tests.

If temporary compatibility is required, isolate it at one boundary, document the removal condition, and keep it out of the canonical domain model. Treat deployment reversibility as a separate requirement from permanent backward compatibility.

## Verify and simplify

- Reproduce the failure before editing when practical. For a quality finding, establish the current unnecessary work or maintenance cost and the behavior that must remain stable.
- Verify the contract with the smallest useful check. For bugs, prefer a regression that fails before the fix. For simplifications, check preserved behavior and the claimed reduction in work; do not add tests that only assert code shape.
- Run focused validation for the changed path plus repository-required checks proportional to the risk.
- Try to delete or inline code introduced by the fix without changing behavior. Keep the current implementation when nothing can be removed safely.

Review the completed change in two separate passes:

1. **Resolution check.** Re-run the original counterexample or verify that the identified quality cost was removed. Trace the corrected path and preserved behavior to prove the admitted finding is resolved.
2. **Fresh regression check.** Ignore the implementation rationale and review the final diff as a new change. Trace changed inputs, outputs, errors, state, callers, persistence, and side effects. Challenge assumptions introduced by the correction, especially at its input boundary; rechecking only the original counterexample is insufficient. Look for bypasses, new impossible states, removed behavior, extra files, legacy paths, and unrelated formatting.

Report the original finding as resolved, unresolved, or unverified. Report any newly introduced problem through the normal finding admission gate. A green command is evidence, not proof that either pass succeeded.
