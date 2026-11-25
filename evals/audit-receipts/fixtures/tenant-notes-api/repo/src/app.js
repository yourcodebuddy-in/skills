import { findSessionUser, tokenFromRequest } from './auth/sessions.js';
import { readJson } from './http/body.js';
import { HttpError, notFound } from './http/errors.js';
import { send, sendError } from './http/respond.js';
import { createRouter } from './http/router.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerExportRoutes } from './routes/export.js';
import { registerNoteRoutes } from './routes/notes.js';
import { registerShareRoutes } from './routes/shares.js';
import { registerTeamRoutes } from './routes/teams.js';

export function createApp({ db, mailer, config, clock = () => new Date(), log = console }) {
  const router = createRouter();
  const deps = { db, mailer, config };
  registerAuthRoutes(router, deps);
  registerTeamRoutes(router, deps);
  registerNoteRoutes(router, deps);
  registerShareRoutes(router, deps);
  registerExportRoutes(router, deps);

  return async function handle(req, res) {
    const started = performance.now();
    const url = new URL(req.url ?? '/', 'http://localhost');
    let route = 'unmatched';

    try {
      const match = router.match(req.method, url.pathname);
      if (!match) {
        throw notFound();
      }
      if (match.methodNotAllowed) {
        throw new HttpError(405, 'Method not allowed');
      }
      route = match.route.pattern;

      const now = clock();
      const ctx = {
        req,
        url,
        now,
        params: match.params,
        user: findSessionUser(db, tokenFromRequest(req), now),
        body: () => readJson(req),
      };
      send(res, await match.route.handler(ctx));
    } catch (error) {
      sendError(res, error, log);
    } finally {
      const ms = (performance.now() - started).toFixed(1);
      log.info(`${req.method} ${route} ${res.statusCode} ${ms}ms`);
    }
  };
}
