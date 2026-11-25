# Contributing

Thanks for helping. A few things keep this codebase small and predictable.

## Before you start

- Read [docs/architecture.md](docs/architecture.md) and the ADRs in [docs/adr](docs/adr) for the area you're changing. If your change needs a new pattern, write a short ADR first.
- Stay on the standard library. A new dependency needs an ADR and a good reason.

## Making a change

- One behaviour per pull request.
- Add or change tests with the code. Tests use `node:test` and start the real app on a random port; see `test/helpers.js`.
- Keep route files thin. Permission checks go in the route, through `requireRole`; data access goes in the feature module.
- Schema changes are a new entry at the end of `src/db/migrations.js`. Never edit a migration that has shipped.
- Update the README and `docs/api.md` in the same pull request when behaviour changes.

## Checks

CI runs `node --test` on every pull request and push to `main`. `main` is protected, so a pull request with failing tests can't merge.

Run the same thing locally:

```sh
npm test
```

## Reviews

Reviews follow [docs/REVIEWING.md](docs/REVIEWING.md), including the periodic whole-repo reviews.
