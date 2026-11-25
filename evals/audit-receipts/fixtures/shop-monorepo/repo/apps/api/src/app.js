import { DomainError } from "../../../packages/core/src/index.js";
import { ProviderError } from "../../../packages/payments/src/index.js";
import { authorize, currentUser } from "./auth.js";
import { HttpError, isJsonRequest, parseCookies, parseJsonObject, readBody, sendJson } from "./http.js";
import { createRouter } from "./router.js";
import { accountRoutes } from "./routes/account.js";
import { adminRoutes } from "./routes/admin.js";
import { cartRoutes } from "./routes/cart.js";
import { checkoutRoutes } from "./routes/checkout.js";
import { devRoutes } from "./routes/dev.js";
import { orderRoutes } from "./routes/orders.js";
import { productRoutes } from "./routes/products.js";
import { webhookRoutes } from "./routes/webhooks.js";
import { createStaticHandler } from "./static.js";

const errorBody = (code, message, details) => ({ error: { code, message, ...(details ? { details } : {}) } });

const NOT_FOUND = errorBody("not_found", "Not found");

// Maps an error to [status, body]. Anything unexpected is a 500 with no detail sent to the client.
const describeError = (error) => {
  if (error instanceof DomainError) {
    return [error.status, errorBody(error.code, error.message, error.details)];
  }
  if (error instanceof HttpError) {
    return [error.status, errorBody(error.code, error.message)];
  }
  if (error instanceof ProviderError) {
    return [502, errorBody("payment_provider_error", "The payment provider couldn't complete that. Please try again.")];
  }
  if (error instanceof URIError) {
    return [400, errorBody("invalid_path", "The address isn't valid")];
  }
  return [500, errorBody("internal", "Something went wrong on our side")];
};

export const createApp = ({ store, payments, config, logger, now = () => new Date() }) => {
  const router = createRouter();
  const deps = { store, payments, config, logger };
  accountRoutes(router, deps);
  productRoutes(router, deps);
  cartRoutes(router, deps);
  checkoutRoutes(router, deps);
  orderRoutes(router, deps);
  adminRoutes(router, deps);
  webhookRoutes(router, deps);
  if (config.mode !== "production") {
    devRoutes(router, deps);
  }
  const serveStatic = createStaticHandler(config.webRoot);

  const handle = async (req, res, url) => {
    if (!url.pathname.startsWith("/api/")) {
      if (req.method === "GET" && (await serveStatic(url.pathname, res))) {
        return;
      }
      sendJson(res, 404, NOT_FOUND);
      return;
    }

    const { route, params, allowed } = router.match(req.method, url.pathname);
    if (!route) {
      if (allowed.length > 0) {
        sendJson(res, 405, errorBody("method_not_allowed", "Method not allowed"), { Allow: allowed.join(", ") });
        return;
      }
      sendJson(res, 404, NOT_FOUND);
      return;
    }

    // Every request that changes something must be JSON (docs/adr/0004-csrf-without-tokens.md).
    let rawBody = "";
    let body = {};
    if (req.method !== "GET") {
      if (!isJsonRequest(req.headers)) {
        throw new HttpError(415, "unsupported_media_type", "Send JSON with Content-Type: application/json");
      }
      rawBody = await readBody(req);
      body = parseJsonObject(rawBody);
    }

    const cookies = parseCookies(req.headers.cookie);
    const at = now();
    const user = currentUser(store, cookies, at);
    authorize(user, route.auth);

    const result = await route.handler({
      params,
      query: url.searchParams,
      headers: req.headers,
      cookies,
      body,
      rawBody,
      user,
      now: at,
    });
    sendJson(res, result.status ?? 200, result.body, result.headers);
  };

  return async (req, res) => {
    const started = performance.now();
    const url = new URL(req.url, "http://localhost");
    let status;
    try {
      await handle(req, res, url);
      status = res.statusCode;
    } catch (error) {
      const [errorStatus, payload] = describeError(error);
      status = errorStatus;
      if (status >= 500) {
        logger.error("request.failed", { method: req.method, path: url.pathname, error: error.stack ?? String(error) });
      }
      if (!res.headersSent) {
        sendJson(res, status, payload);
      }
    }
    if (url.pathname.startsWith("/api/")) {
      logger.info("request", {
        method: req.method,
        path: url.pathname,
        status,
        ms: Math.round(performance.now() - started),
      });
    }
  };
};
