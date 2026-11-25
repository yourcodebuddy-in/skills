// Runs the API in-process against an in-memory database, without opening a port.
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { createStore, openDatabase } from "../../../packages/db/src/index.js";
import { SIGNATURE_HEADER, createPaymentProvider } from "../../../packages/payments/src/index.js";
import { createApp } from "../src/app.js";
import { silentLogger } from "../src/logger.js";

export const WEBHOOK_SECRET = "whsec_test_api";

export const testConfig = (overrides = {}) => ({
  mode: "test",
  webRoot: fileURLToPath(new URL("../../web/public", import.meta.url)),
  paymentProvider: "fakepay",
  webhookSecret: WEBHOOK_SECRET,
  sessionTtlHours: 12,
  secureCookies: false,
  ...overrides,
});

class TestResponse {
  statusCode = 200;
  headers = {};
  headersSent = false;
  #chunks = [];
  #done;
  finished = new Promise((resolve) => {
    this.#done = resolve;
  });

  setHeader(name, value) {
    this.headers[name.toLowerCase()] = value;
  }

  writeHead(status, headers = {}) {
    this.statusCode = status;
    for (const [name, value] of Object.entries(headers)) {
      this.setHeader(name, value);
    }
    this.headersSent = true;
  }

  end(chunk) {
    if (chunk !== undefined) {
      this.#chunks.push(Buffer.from(chunk));
    }
    this.#done();
  }

  get text() {
    return Buffer.concat(this.#chunks).toString("utf8");
  }
}

export const inject = async (handler, { method = "GET", path, body, headers = {}, cookie } = {}) => {
  let payload = "";
  if (body !== undefined) {
    payload = typeof body === "string" ? body : JSON.stringify(body);
  }
  const req = Readable.from(payload ? [Buffer.from(payload)] : []);
  req.method = method;
  req.url = path;
  req.headers = { host: "shop.test" };
  if (method !== "GET") {
    req.headers["content-type"] = "application/json";
  }
  for (const [name, value] of Object.entries(headers)) {
    req.headers[name.toLowerCase()] = value;
  }
  if (cookie) {
    req.headers.cookie = cookie;
  }
  const res = new TestResponse();
  await handler(req, res);
  await res.finished;
  const type = res.headers["content-type"] ?? "";
  return {
    status: res.statusCode,
    headers: res.headers,
    text: res.text,
    body: type.startsWith("application/json") && res.text ? JSON.parse(res.text) : null,
  };
};

const sessionCookie = (response) => response.headers["set-cookie"]?.split(";")[0];

// deliveries keeps every webhook the fake provider sent, as { body, signature }.
export const createTestApp = ({ config: overrides, provider, now } = {}) => {
  const store = createStore(openDatabase(":memory:"));
  const config = testConfig(overrides);
  const deliveries = [];
  let app;
  const payments =
    provider ??
    createPaymentProvider("fakepay", {
      webhookSecret: config.webhookSecret,
      deliver: async (delivery) => {
        deliveries.push(delivery);
        const response = await inject(app, {
          method: "POST",
          path: "/api/webhooks/payments",
          body: delivery.body,
          headers: { [SIGNATURE_HEADER]: delivery.signature },
        });
        return response.status < 300;
      },
    });
  app = createApp({ store, payments, config, logger: silentLogger, now });
  const request = (options) => inject(app, options);

  const signUp = async ({ email = "shopper@example.com", name = "Sam Shopper", password = "correct horse battery", admin = false } = {}) => {
    const response = await request({ method: "POST", path: "/api/account/register", body: { email, name, password } });
    if (response.status !== 201) {
      throw new Error(`sign-up failed: ${response.text}`);
    }
    if (admin) {
      store.users.setRole(response.body.user.id, "admin");
    }
    return { cookie: sessionCookie(response), user: response.body.user };
  };

  const addProduct = (product = {}) =>
    store.products.create(
      {
        sku: "MUG-STONE",
        name: "Stoneware mug",
        description: "Hand-glazed.",
        priceCents: 1800,
        stock: 10,
        ...product,
      },
      new Date().toISOString(),
    );

  return { app, store, payments, deliveries, config, request, signUp, addProduct, sessionCookie };
};

export const SHIPPING = Object.freeze({
  name: "Sam Shopper",
  line1: "1 Main Street",
  city: "Springfield",
  postcode: "12345",
  country: "US",
});

// Adds products to the shopper's cart and checks out. Returns the checkout response body.
export const checkout = async (t, cookie, lines, extra = {}) => {
  for (const { productId, quantity = 1 } of lines) {
    const added = await t.request({ method: "POST", path: "/api/cart/items", cookie, body: { productId, quantity } });
    if (added.status !== 201) {
      throw new Error(`add to cart failed: ${added.text}`);
    }
  }
  const response = await t.request({ method: "POST", path: "/api/checkout", cookie, body: { shipping: SHIPPING, ...extra } });
  if (response.status !== 201) {
    throw new Error(`checkout failed: ${response.text}`);
  }
  return response.body;
};
