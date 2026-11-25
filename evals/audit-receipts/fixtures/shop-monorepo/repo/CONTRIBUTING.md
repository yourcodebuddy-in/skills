# Contributing

## Setup

Install Node 26 (`.nvmrc` has the version). There is nothing else to install.

```sh
node --test                 # everything
node --test packages/core   # one package
```

## Conventions

- ES modules, arrow functions, `const` by default.
- Shop rules belong in `packages/core`; SQL belongs in `packages/db`; HTTP concerns belong in
  `apps/api`. A route handler should read like: parse input, call core, shape the response.
- Validate input with the parsers in `packages/core/src/validate.js`, which throw a
  `ValidationError` the API turns into a 400.
- Throw the errors in `packages/core/src/errors.js` for expected failures; the API maps them to
  statuses. Anything else is a 500 and gets logged.
- Never edit a migration that has shipped. Add a new one to the end of
  `packages/db/src/migrations.js`.
- In the web app, put HTML-building code in the pure view modules and run every value that came
  from a user or the database through `escapeHtml`.

## Decisions

Anything that sets a pattern other code will copy gets a short record in `docs/adr/`. Read the
existing ones before changing the area they cover.

## Pull requests

One change per pull request, with a description of what a shopper or staff member will notice.
Reviews follow [docs/REVIEWING.md](docs/REVIEWING.md).
