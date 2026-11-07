---
name: code-review
description: Review existing software and changes for correctness, security, performance, clarity, maintainability, and unnecessary complexity. Use for PR reviews and code audits. Include code quality by default, even when no bug is found. Report findings only unless the user explicitly asks for fixes.
---

# Code review

Assess whether the code behaves correctly and whether it is well written for its purpose. Trace important behavior, examine implementation choices, challenge each concern, and state what was and was not verified.

## Review contract

- Match finding eligibility to the requested review mode. Read coupled code to understand the system; reading a file does not make every issue in it eligible for the report.
- Treat existing behavior and local patterns as evidence, not proof of intent. Derive requirements and invariants from the strongest available sources.
- General reviews include correctness and implementation quality. Do not stop after finding bugs or wait for a separate request to assess performance, readability, idiomatic use of the framework, maintainability, and unnecessary complexity. Honor an explicitly narrower review scope.
- A request to review, audit, check, or assess authorizes findings only. Do not edit files or perform external mutations unless the user explicitly asks for fixes.
- Do not manufacture work. A clean review with no material findings is a successful result.
- Do not present style preferences, missing fashionable patterns, or hypothetical hardening as defects without a concrete cost or failure path.
- Compiler, linter, scanner, and test results are evidence. None proves runtime or system correctness by itself.
- Preserve unrelated worktree changes. Do not run destructive commands or broad formatting passes.

## Choose the evidence set

Select the mode that matches the request:

| Mode | Question | Evidence |
| --- | --- | --- |
| Baseline | Is this existing scope correct and well implemented? | The requested scope, coupled callers and consumers, contracts, configuration, persistence, and tests |
| Change | Is this change correct, well implemented, and complete? | A pinned base and head, plus staged, unstaged, and untracked files in scope |
| Spec | Does the implementation satisfy its requirements? | The user request, issue, acceptance criteria, domain documentation, and observable contracts |
| Combined | Is the system sound, and is the change correct? | Baseline, change, and specification evidence together |

Default a PR, commit, or diff review to **Change** mode. Pin its base and head and report issues introduced or made reachable by those changes, including regressions in unchanged consumers. Existing unrelated defects and cleanup in surrounding files are outside finding scope. Review a named existing feature or directory in **Baseline** mode. Use **Combined** only when the request includes both the change and the existing system. A narrow request, such as security-only or complexity-only, keeps its stated boundary.

Before investigating, state the mode, finding boundary, and review dimensions in one short scope statement. Do not expand a PR review into a feature or repository audit because its dependencies contain other problems.

Git history can explain intent and regressions, but it never defines the review boundary. If the requested baseline or scope is ambiguous and materially changes the result, resolve it from repository context or state the assumption.

Assess simplification in every general review. Define the observable behavior that must remain stable from requirements, contracts, callers, and tests, then consider whether existing project code, standard APIs, fewer state copies, or fewer layers achieve it more directly. A quality finding does not need an existing runtime bug, but it does need a concrete cost and a simpler alternative with understood tradeoffs. Fewer lines alone do not establish a better design. Separate verified behavior-preserving reductions from ideas whose equivalence remains uncertain.

## Build a review map

Before looking for faults, identify:

- the requested scope and the directly coupled code that must be inspected;
- the intended behavior, current behavior, and source of each requirement;
- important invariants, trust boundaries, authorities, and state transitions;
- persisted state, external effects, failure ownership, and runtime constraints;
- expected data sizes and execution frequency, plus existing domain abstractions and framework conventions;
- the canonical representation after the change, plus any required compatibility or migration;
- assumptions and boundaries that cannot be verified.

For a large change, distinguish wording-only edits from changes to control flow, validation, contracts, shared utilities, and initialization. Review shared behavioral changes before sweeping wording-only edits. Expand from public entry points into critical flows, state owners, boundaries, and tests. Track which components and risk areas received deep, partial, or no review. Never imply exhaustive coverage when the available time or context did not support it.

## Review in five passes

Scale each pass to the size and risk of the request. For a non-trivial review, read [references/review-checklist.md](references/review-checklist.md) and apply its relevant sections. Do not skip the quality pass because behavior checks pass, or skip the evidence gate to fill it.

1. **Understand.** Build the review map before criticizing implementation choices.
2. **Verify behavior.** Trace important success, failure, retry, cancellation, and concurrent paths end to end.
3. **Assess implementation quality.** Examine work done per render, request, and save; data loading and query shape; state and rule ownership; clarity of control flow and types; reuse of domain abstractions; and whether layers, dependencies, and compatibility paths serve current requirements. Compare questionable choices with the smallest correct alternative. Preserve necessary validation, authorization, concurrency controls, and error handling.
4. **Challenge.** For a behavioral concern, construct a concrete counterexample. For a quality concern, demonstrate the unnecessary work or maintenance cost and check the proposed alternative against current callers and requirements. Search for disproof in middleware, validators, constraints, framework guarantees, deliberate design tradeoffs, deployment rules, and tests. Measure performance when the impact depends on unknown constants; do not label an operation slow solely by its name.
5. **Conclude.** Admit supported findings from both passes. Record coverage, disproved suspicions worth preserving, and residual uncertainty. Stop when no additional material issue meets the gate.

## Completion gate

Before concluding a general review, account for behavioral correctness, authorization and boundaries, performance and data loading, state and contract ownership, and clarity and unnecessary complexity. For each dimension, record a finding, examined with no material finding, not applicable with a reason, or not verified with its limit.

For each changed shared module, support that record with concrete evidence about:

- who owns its inputs and where untrusted values are validated;
- whether its types and assumptions agree with installed library contracts and actual emitted values;
- the success, failure, fallback, and boundary behavior relevant to its callers;
- whether computed information reaches the consumer that needs it;
- duplicated contracts, assertions, redundant branches, and simpler existing alternatives.

Keep the evidence compact in the response; do not create a review artifact unless requested. A passing check, one successful example, or a generic claim that a dimension was reviewed does not complete it. Mark missing evidence as unverified and limit the verdict accordingly. Do not stop after the first actionable findings while shared behavior or implementation quality remains unexamined. Do not target a finding count or add low-impact cleanup to fill a category.

## Finding admission gate

A finding must establish all applicable facts:

1. The expected behavior, invariant, project rule, or quality goal and its source.
2. The exact location and reachable code path or affected maintenance task.
3. A triggering input, state, event sequence, maintenance operation, or demonstrable unnecessary mechanism.
4. The actual result and its concrete correctness, resource, comprehension, or change cost.
5. Why existing protections or design constraints do not resolve or justify the concern.
6. Evidence that the impact is material enough to report.
7. For Change mode, the changed behavior or newly reachable interaction that makes this finding attributable to the pinned change. An unchanged line may be the right location for a regression, but explain the causal link.

For a quality finding, show the cost and the correction, without requiring a runtime failure first. Evidence can include repeated serialization where a stable identifier exists, repeated linear searches inside a list render, fetching or rewriting unrelated data, duplicated state or business rules, misleading names or tangled control flow that obscure an invariant, or layers that a concrete simpler implementation can remove. Explain why the alternative preserves required behavior and reduces the identified cost. One caller, a large file, or a personal formatting preference is not sufficient evidence by itself.

If evidence is missing, investigate further or record the point as unverified. Do not turn "I could not confirm this" into a defect. Speculative concerns are excluded by default.

A constructed counterexample establishes the behavior it exercises, not automatically a reachable application failure. Distinguish violations of the reviewed helper's explicit contract from failures traced through current application callers. Calibrate confidence and impact against the full claim, including any unverified premise.

## Calibrate findings

Severity measures impact:

- **Critical.** Reachable loss of security or data, irreversible corruption, or failure of a core system.
- **High.** A primary workflow, authorization boundary, or important domain result fails under realistic conditions.
- **Medium.** A real but constrained correctness, recovery, performance, or maintenance problem.
- **Low.** A localized correctness or quality issue with small impact. Do not use Low for personal taste, or assign every quality finding Low automatically.

Confidence measures evidence:

- **Confirmed.** Reproduced by a check or established by a complete static trace with no material unresolved assumption.
- **Likely.** The path and impact are concrete, but one runtime or environmental premise remains unverified.
- **Unverified.** Evidence is insufficient. List separately, not as a finding.

Security severity requires a reachable source-to-operation path. Probability may affect severity, but it does not lower confidence when the path itself is proven.

## Report and preserve review state

Put findings first, ordered by severity. Give each a stable ID and include:

- severity, confidence, category, and exact location;
- the behavioral failure or quality cost, its evidence, and affected path;
- protections or tradeoffs checked, impact, verification method, and the smallest supported correction. For simplifications, name what can be removed or reused and which behavior must remain stable.

Then provide a compact review ledger with mode, scope or baseline, specification sources, assumptions, coverage by component and risk area, meaningful disproved suspicions, unverified boundaries, and checks run. State separate verdicts for behavioral correctness and implementation quality, followed by a merge recommendation when requested. Distinguish changes required before merging from non-blocking quality findings. No known bug is not enough to conclude that the code is well written or ready to merge.

If there are no findings, say "No material findings" and briefly explain the quality assessment as well as coverage and residual uncertainty. Do not pad the response with optional improvements. A supported performance, clarity, or simplification finding belongs in the findings even when no bug exists.

For a later review, consume the previous ledger and perform a delta review unless the user asks for a fresh audit. Do not revive rejected findings unless relevant code, requirements, or assumptions changed. Report new regressions, newly reachable interactions, and previously missed findings that now meet the admission gate. Identify whether additional findings are new, previously missed, newly evidenced, or admitted only because the scope changed. State any scope change explicitly; do not present a broader baseline review as additional PR regressions.

Do not create a ledger file unless the user asks to persist the report.

## Fixes when authorized

Before changing code for an admitted finding, read [references/fixing-findings.md](references/fixing-findings.md). After the fix, verify that the original failure or quality cost is resolved and required behavior is preserved. Then review the final diff as a fresh change and trace every changed contract outward for new regressions. Do not rely on the rationale used to produce the fix.
