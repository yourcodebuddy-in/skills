# Libraries, SDKs, CLIs, public APIs, docs

- **Breaking changes:** does a rename, removed option, changed default, narrowed type, new required argument, or changed error break existing callers, even if tests pass? Check both signatures and behavior.
- **Versioning:** does the version bump and changelog match what actually changed? A rename in a patch release described as "no behavior change" is wrong on both counts.
- **Compatibility path:** if a break is needed, is there a deprecation or alias where the project's policy expects one? Don't ask for one when no outside consumer exists.
- **Stored and wire formats:** can data written by the old version still be read, and the reverse where needed?
- **CLI contract:** do flags, exit codes, and stdout stay stable for scripts that parse them? Are errors sent to stderr with a nonzero exit?
- **Destructive commands:** is there a confirmation, a dry run, and safe behavior on partial failure?
- **Input handling:** how are empty, malformed, huge, and non-UTF-8 inputs and paths with spaces handled?
- **Surface area:** does this export more than it needs to? Everything public becomes a promise.
- **Docs against code:** run or trace each documented command, flag, option, default, and example. Does it exist and behave as written?
- **Examples:** would a copied example actually work with the current API?
- **Types and contracts:** do declared types match runtime behavior, including nulls and errors?
