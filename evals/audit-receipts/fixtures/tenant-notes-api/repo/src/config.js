const TRANSPORTS = new Set(['log', 'http']);

const readNumber = (value, fallback, name) => {
  if (value === undefined || value === '') {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive number, got "${value}"`);
  }
  return parsed;
};

export function loadConfig(env = process.env) {
  const transport = env.MAIL_TRANSPORT ?? 'log';
  if (!TRANSPORTS.has(transport)) {
    throw new Error(`MAIL_TRANSPORT must be one of: ${[...TRANSPORTS].join(', ')}`);
  }
  if (transport === 'http' && !(env.MAIL_API_URL && env.MAIL_API_KEY)) {
    throw new Error('MAIL_TRANSPORT=http needs MAIL_API_URL and MAIL_API_KEY');
  }

  return {
    port: readNumber(env.PORT, 3000, 'PORT'),
    databasePath: env.DATABASE_PATH ?? './data/notes.db',
    publicUrl: (env.PUBLIC_URL ?? 'http://localhost:3000').replace(/\/+$/, ''),
    sessionDays: readNumber(env.SESSION_DAYS, 14, 'SESSION_DAYS'),
    cookieSecure: env.COOKIE_SECURE !== 'false',
    mail: {
      transport,
      url: env.MAIL_API_URL,
      apiKey: env.MAIL_API_KEY,
      from: env.MAIL_FROM ?? 'Tenant Notes <notes@localhost>',
    },
  };
}
