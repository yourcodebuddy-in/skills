import { HttpError } from './http/errors.js';
import { json } from './http/respond.js';
import { createRouter } from './http/router.js';
import { registerEventRoutes } from './routes/events.js';
import { registerPublicRoutes } from './routes/public.js';
import { registerWebhookRoutes } from './routes/webhooks.js';

// The application as a function from request to response, so tests can call it without a socket.
export function createApp(ctx) {
  const router = createRouter();
  router.get('/healthz', () => json(200, { ok: true }));
  registerEventRoutes(router, ctx);
  registerPublicRoutes(router, ctx);
  registerWebhookRoutes(router, ctx);

  const handle = async ({ method, url, headers = {}, body = '' }) => {
    const parsed = new URL(url, 'http://boxoffice.local');
    const { handler, params, pathMatched } = router.match(method, parsed.pathname);
    if (!handler) return json(pathMatched ? 405 : 404, { error: pathMatched ? 'method_not_allowed' : 'not_found' });

    const req = {
      method,
      path: parsed.pathname,
      query: parsed.searchParams,
      headers,
      params,
      rawBody: body,
      json() {
        if (body === '') return {};
        try {
          return JSON.parse(body);
        } catch {
          throw new HttpError(400, 'invalid_json');
        }
      },
    };

    try {
      return await handler(req);
    } catch (error) {
      if (error instanceof HttpError) return json(error.status, { error: error.code, ...error.details });
      ctx.log.error('request.failed', { method, path: parsed.pathname, error: error.message });
      return json(500, { error: 'internal_error' });
    }
  };

  return { handle };
}
