// Settings come from the environment. Every setting has a default that works for local development,
// except the payment and mail credentials, which production must set.

const int = (value, fallback) => {
  if (value === undefined || value === '') return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) throw new Error(`Expected a whole number, got "${value}"`);
  return parsed;
};

export function loadConfig(env = process.env) {
  const config = {
    env: env.NODE_ENV ?? 'development',
    port: int(env.PORT, 3000),
    databasePath: env.DATABASE_PATH ?? './data/boxoffice.db',
    publicUrl: env.PUBLIC_URL ?? 'http://localhost:3000',
    currency: env.CURRENCY ?? 'EUR',
    holdMinutes: int(env.HOLD_MINUTES, 15),
    maxTicketsPerHold: int(env.MAX_TICKETS_PER_HOLD, 8),
    bookingFeeBps: int(env.BOOKING_FEE_BPS, 500),
    maxBodyBytes: int(env.MAX_BODY_BYTES, 64 * 1024),
    payments: {
      url: env.PAYMENTS_URL ?? 'http://localhost:4010',
      apiKey: env.PAYMENTS_API_KEY ?? '',
      webhookSecret: env.PAYMENTS_WEBHOOK_SECRET ?? '',
      timeoutMs: int(env.PAYMENTS_TIMEOUT_MS, 10_000),
    },
    mail: {
      transport: env.MAIL_TRANSPORT ?? 'log',
      from: env.MAIL_FROM ?? 'Box Office <tickets@localhost>',
      dir: env.MAIL_DIR ?? './data/mail',
      apiUrl: env.MAIL_API_URL ?? '',
      apiKey: env.MAIL_API_KEY ?? '',
      timeoutMs: int(env.MAIL_TIMEOUT_MS, 10_000),
    },
    worker: {
      intervalSeconds: int(env.WORKER_INTERVAL_SECONDS, 30),
      batchSize: int(env.WORKER_BATCH_SIZE, 50),
    },
    logLevel: env.LOG_LEVEL ?? 'info',
  };

  if (config.env === 'production') {
    for (const [name, value] of [
      ['PAYMENTS_API_KEY', config.payments.apiKey],
      ['PAYMENTS_WEBHOOK_SECRET', config.payments.webhookSecret],
    ]) {
      if (!value) throw new Error(`${name} must be set in production`);
    }
  }
  return config;
}
