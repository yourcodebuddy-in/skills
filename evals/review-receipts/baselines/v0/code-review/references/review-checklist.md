# Review risk catalog

Use this catalog to choose questions that fit the requested system. General reviews cover behavior and implementation quality, even when no runtime failure is found. It is not a quota. Mark irrelevant areas as not applicable, and do not invent a finding to fill a category.

## Requirements, behavior, and state

- Does each important flow end in the state promised by the requirement or public contract?
- Are preconditions and invalid state transitions enforced by the layer that owns the state?
- Can missing, empty, zero, duplicate, malformed, maximum-size, reordered, or boundary-time inputs change the meaning?
- Do derived values and materialized state update whenever their sources change?
- Can the model represent contradictory combinations that the domain says are impossible?
- Did the implementation quietly change the requirement, label, default, or error meaning to match existing code?

## Trust, authority, and security

- Which values cross a trust boundary, and where are their structure and meaning validated before use?
- Is authentication confused with permission to act on this exact tenant, object, field, or operation?
- Can an input reach an interpreter, query, path, template, command, redirect, or deserializer unsafely?
- Can secrets, personal data, internal errors, or privileged fields escape through output, logs, analytics, or caches?
- Are limits enforced on input size, recursion, fan-out, retries, and expensive parsing?
- Does a claimed vulnerability have a complete source-to-operation path after all guards and policies are considered?

## Data, canonical state, and migration

- Where is each important invariant owned, and does persistence enforce it when callers can race or bypass one another?
- Are related writes atomic enough for the failure and concurrency model?
- Are affected-row counts, conflicts, missing records, and partial writes interpreted correctly?
- What representation is canonical after the change?
- How does existing persisted or externally stored state reach that representation?
- Does the code keep obsolete fields, enums, readers, writers, fallbacks, or dual representations alive without a current requirement?
- If compatibility is required, is it isolated at a boundary with a clear removal condition?
- Can the deployment and rollback sequence cross old and new schemas safely without creating permanent compatibility code?

## Concurrency, failure, and side effects

- What happens when the same action runs twice, overlaps itself, arrives out of order, or resumes after partial success?
- Are check-then-write sequences protected by an authoritative atomic mechanism where needed?
- Are retries bounded and safe for the operation's idempotency rules?
- Does cancellation or timeout leave durable state and acquired resources recoverable?
- Is failure handled once at the correct boundary, or swallowed, duplicated, converted to a magic value, or reported as success?
- Can an auxiliary side effect such as email, telemetry, cache work, or notification redefine the success of the primary operation?
- Does multi-system work acknowledge that one local transaction cannot make external effects atomic?

## Interfaces, types, and serialization

- Do producer, validator, consumer, and stored representation agree on required fields, nullability, defaults, ordering, and error semantics?
- Are static types being mistaken for runtime validation of external or persisted values?
- Did code bypass type, schema, compiler, or runtime guarantees through casts, suppressions, unchecked operations, or widened types?
- Are types derived from their authoritative schema or maintained as competing declarations?
- Can serialization lose precision, units, time-zone meaning, encoding, or identity?
- Does the implementation use APIs and configuration supported by the installed dependency and runtime versions?

## Lifecycle and client behavior

- Are loading, empty, missing, partial, read-only, failure, retry, and success distinct where users or callers observe them?
- Can stale responses, duplicated state, remounts, navigation, or repeated input overwrite newer truth?
- Does a UI close, redirect, acknowledge, or clear input before the underlying operation succeeds?
- Are resources such as handles, streams, locks, subscriptions, listeners, timers, workers, and temporary files released on every path?
- Do long-running operations support the cancellation and cleanup behavior their environment requires?
- Are accessibility and input-preservation failures material to the reviewed workflow?

## Performance and operations

- Does work remain bounded as data, tenants, requests, files, or jobs grow?
- Are repeated remote calls, queries, serialization, scans, or sequential waits multiplied inside a loop or hot path?
- What is the cost per item, render, request, and save? Do repeated list lookups turn a linear pass into quadratic work where an index or map would suffice?
- Are keys and comparisons based on domain identity, or do they serialize entire objects unnecessarily? For example, inspect a repeated `JSON.stringify(record)` React key when `record.id` already identifies the row. Check the intended remount behavior; do not prohibit serialization needed by an actual wire format, snapshot, or cache contract.
- Do essential requests eagerly load full histories, inactive tabs, export-only data, or large object graphs? Can the existing contract use bounded queries, pagination, narrower selection, or fetching at the point of use?
- Does a partial update validate the complete invariant but write only changed data, while preserving transaction boundaries and required side effects?
- Do actual query predicates and ordering have matching indexes? Check generated SQL and realistic cardinality before claiming an indexing problem.
- Are read-only views built from data directly, or do they allocate editable form state, validation, subscriptions, and synchronization that the view does not use?
- Does caching define key isolation, invalidation, authorization context, freshness, and failure behavior?
- Does a proposed optimization remove work established by the code or address measured or required scale, without adding a larger system cost?
- Is the finding unnecessary work established by the code, or a claim about latency that still needs measurement? Keep the claim within the evidence.
- Would a production failure be diagnosable without logging secrets or flooding unstructured output?
- Do local, CI, and production differences in database behavior, filesystem, time, case sensitivity, networking, or process count invalidate an assumption?

## Dependencies, configuration, and deployment

- Does a new dependency solve a current problem better than existing project code, the standard library, or the platform?
- Did a small behavior change bring surprising lockfile, generated-file, permission, environment, infrastructure, or configuration changes?
- Does configuration fail clearly when required values are missing, or do defaults hide a broken deployment?
- Did the change weaken compiler, linter, test, security, CI, or deployment controls to obtain a passing result?
- Are new permissions the minimum needed by the runtime path?
- Are migrations, backfills, feature flags, scheduled work, and cleanup ordered and owned?
- Can deployment fail halfway, and is recovery possible without pretending permanent backward compatibility is required?

## Tests and verification

- Does a test reproduce the requirement or failure rather than mirror the implementation?
- Would the test fail before the correction and under a plausible wrong implementation?
- Did mocks remove the boundary, authorization, transaction, or integration behavior that matters?
- Are invalid input, permission denial, duplicates, concurrency, and partial failure tested when they are part of the risk?
- Were assertions, snapshots, timeouts, retries, skips, fixtures, or expected values weakened to make the suite pass?
- Do passing checks cover the claimed behavior, or only compilation and unrelated paths?
- Which important behavior remains untested or impossible to verify in the current environment?

## Architecture, coupling, and deletion

- Does requirement complexity justify the number of new concepts, layers, files, dependencies, and configuration choices?
- Is one business rule owned in several places even when the code does not look textually duplicated?
- Do storage keys, events, queue names, paths, schedules, serialized data, or flags create hidden interfaces?
- Are wrappers, factories, interfaces, generic helpers, fallback branches, or duplicated state justified by current reuse, policy, or ownership, or could callers use their source directly?
- What old code, fields, flags, configuration, tests, comments, or adapters should no longer exist after the change?
- Is an odd-looking construct supported by history or a current constraint, and does that reason still apply?
- Would a simpler correction preserve the required behavior and local conventions with less change risk?
- Is there an existing domain component, hook, query, or schema that handles this requirement, or did the change create a parallel pipeline?
- Are local state, caches, derived values, and persisted data competing to own the same truth? Can one representation be derived from its authoritative source?
- Can bespoke code be replaced with an existing standard or framework API without losing domain validation or failure semantics?

## Clarity, types, and local conventions

- Can a reader identify the state owner, units, meaning of values, side effects, and failure path from the names and control flow? Point to the ambiguity rather than suggesting cosmetic renames.
- Do nested conditions, boolean combinations, or repeated transformations hide a rule that a direct expression, discriminated state, or existing domain helper would make explicit?
- Do types express the domain contract and reject contradictory states, or do assertions, broad optional fields, duplicated interfaces, and fallback values obscure it?
- Is a repeated pattern appropriate to the installed framework and this codebase, including server/client boundaries, rendering, memoization, forms, and error defaults? Local consistency does not justify copying a defect.
- If a correct implementation is difficult to follow or change, what concrete maintenance task becomes harder, and what smaller equivalent implementation would make it clearer?

## Negative space

Look for required mechanisms that are absent rather than an incorrect line. Examples include a state change without authorization, a persisted representation change without migration, a retry without idempotency, a cache without invalidation, a resource without cleanup, an external call without a bounded failure policy, or a new state without transition rules. Report one only when the missing mechanism creates a reachable, material failure.
