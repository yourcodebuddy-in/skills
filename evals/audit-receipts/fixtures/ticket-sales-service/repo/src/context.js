import { openDatabase } from './db.js';
import { systemClock } from './lib/time.js';
import { createLogger } from './log.js';
import { createMailer } from './mail/mailer.js';
import { createGateway } from './payments/gateway.js';

// Everything a request handler or job needs. Tests build their own with fakes for the outside world.
export function createContext(config, overrides = {}) {
  const log = overrides.log ?? createLogger({ level: config.logLevel });
  return {
    config,
    log,
    db: overrides.db ?? openDatabase(config.databasePath),
    clock: overrides.clock ?? systemClock,
    gateway: overrides.gateway ?? createGateway(config),
    mailer: overrides.mailer ?? createMailer(config, log),
  };
}
