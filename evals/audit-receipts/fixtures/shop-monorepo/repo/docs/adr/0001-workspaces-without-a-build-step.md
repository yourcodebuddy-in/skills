# 1. Workspaces without a build step

Date: 2026-03-02
Status: accepted

## Context

The shop is three packages and two apps maintained by two people. We want the code split by
concern, but every tool we add is one more thing to upgrade, and the machines we deploy to only
have Node.

## Decision

- One repository with npm workspaces syntax (`packages/*`, `apps/*`) so the layout is familiar.
- No dependencies from the registry. Node 26's standard library covers HTTP, SQLite, crypto and
  testing.
- Packages import each other by relative path (`../../../packages/core/src/index.js`) rather than
  by package name, so nothing needs installing or linking. Each package's `src/index.js` is its
  public entry point; other packages import only from there.
- Plain ES modules in the browser too. The web app is served as-is, without bundling.

## Consequences

- `git clone` then `node --test` works on any machine with Node 26.
- Relative import paths are long, and moving a package means updating them.
- If we ever need a registry dependency, we revisit this record first.
