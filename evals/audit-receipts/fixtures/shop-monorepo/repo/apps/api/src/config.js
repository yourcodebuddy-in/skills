import { fileURLToPath } from "node:url";

const WEB_ROOT = fileURLToPath(new URL("../../web/public", import.meta.url));

const required = (env, name) => {
  const value = env[name];
  if (!value) {
    throw new Error(`${name} must be set`);
  }
  return value;
};

const number = (env, name, fallback) => {
  const raw = env[name];
  if (raw === undefined || raw === "") {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number`);
  }
  return value;
};

export const loadConfig = (env = process.env) => {
  const mode = env.NODE_ENV ?? "development";
  return {
    mode,
    host: env.HOST ?? "127.0.0.1",
    port: number(env, "PORT", 3000),
    databaseFile: env.DATABASE_FILE ?? "data/shop.db",
    webRoot: env.WEB_ROOT ?? WEB_ROOT,
    paymentProvider: env.PAYMENT_PROVIDER ?? "fakepay",
    webhookSecret: required(env, "PAYMENT_WEBHOOK_SECRET"),
    sessionTtlHours: number(env, "SESSION_TTL_HOURS", 720),
    secureCookies: mode === "production",
    workerIntervalMs: number(env, "WORKER_INTERVAL_MS", 5000),
  };
};
