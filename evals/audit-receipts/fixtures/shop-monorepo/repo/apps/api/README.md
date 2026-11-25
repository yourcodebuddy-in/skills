# @kettle/api

The HTTP server: JSON under `/api`, and the files in `apps/web/public` everywhere else.

- `src/server.js` wires config, database, payment provider, outbox worker and the HTTP server.
- `src/app.js` turns a request into a call to a route handler and maps errors to responses.
- `src/routes/*.js` registers the routes for one area each. See [docs/api.md](../../docs/api.md).
- `src/serialize.js` decides which fields each audience sees.
- `scripts/` has one-off commands: `seed.js` and `make-admin.js`.

Tests run the app in-process with `test/helpers.js`; no port is opened.
