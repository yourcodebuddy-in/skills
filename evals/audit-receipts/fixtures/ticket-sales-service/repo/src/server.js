import { createServer } from 'node:http';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createContext } from './context.js';
import { toNodeHandler } from './http/node-adapter.js';
import { pendingMigrations } from './migrate.js';

const config = loadConfig();
const ctx = createContext(config);

const pending = pendingMigrations(ctx.db);
if (pending.length > 0) {
  ctx.log.error('server.migrations_pending', { pending: pending.map((migration) => migration.name) });
  process.exit(1);
}

const server = createServer(toNodeHandler(createApp(ctx), { maxBodyBytes: config.maxBodyBytes, log: ctx.log }));
server.requestTimeout = 30_000;
server.headersTimeout = 10_000;

server.listen(config.port, () => ctx.log.info('server.listening', { port: config.port }));

const shutdown = (signal) => {
  ctx.log.info('server.stopping', { signal });
  server.close(() => {
    ctx.db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
