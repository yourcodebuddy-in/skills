import { createServer } from "node:http";
import { createStore, openDatabase } from "../../../packages/db/src/index.js";
import { SIGNATURE_HEADER, createPaymentProvider } from "../../../packages/payments/src/index.js";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createLogger } from "./logger.js";
import { logMailer, startWorker } from "./worker.js";

const WEBHOOK_TIMEOUT_MS = 10_000;

const config = loadConfig();
const logger = createLogger({ level: process.env.LOG_LEVEL ?? "info" });
const db = openDatabase(config.databaseFile);
const store = createStore(db);
const baseUrl = `http://${config.host}:${config.port}`;

const payments = createPaymentProvider(config.paymentProvider, {
  webhookSecret: config.webhookSecret,
  deliver: async ({ body, signature }) => {
    const response = await fetch(`${baseUrl}/api/webhooks/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", [SIGNATURE_HEADER]: signature },
      body,
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });
    return response.ok;
  },
});

const server = createServer(createApp({ store, payments, config, logger }));
server.headersTimeout = 10_000;
server.requestTimeout = 30_000;

const worker = startWorker({ store, payments, logger, send: logMailer(logger), intervalMs: config.workerIntervalMs });

server.listen(config.port, config.host, () => {
  logger.info("server.started", { url: baseUrl, mode: config.mode, provider: payments.name });
});

const shutdown = (signal) => {
  logger.info("server.stopping", { signal });
  worker.stop();
  server.close(() => {
    db.close();
    process.exit(0);
  });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
