# Libraries, SDKs, CLIs, public APIs, docs

- **Public surface:** what do outside callers rely on: exports, endpoints, flags, error shapes, stored formats? Is it documented, and would an easy-looking change break it?
- **Versioning:** do the version, changelog and release notes match what the code does now?
- **Compatibility path:** if a break is needed, is there a deprecation or alias where the project's policy expects one? Don't ask for one when no outside consumer exists.
- **Stored and wire formats:** can data written by the old version still be read, and the reverse where needed?
- **CLI contract:** do flags, exit codes, and stdout stay stable for scripts that parse them? Are errors sent to stderr with a nonzero exit?
- **Destructive commands:** is there a confirmation, a dry run, and safe behavior on partial failure?
- **Input handling:** how are empty, malformed, huge, and non-UTF-8 inputs and paths with spaces handled?
- **Surface area:** does this export more than it needs to? Everything public becomes a promise.
- **Docs against code:** run or trace each documented command, flag, option, default, and example. Does it exist and behave as written?
- **Examples:** would a copied example actually work with the current API?
- **Types and contracts:** do declared types match runtime behavior, including nulls and errors?
