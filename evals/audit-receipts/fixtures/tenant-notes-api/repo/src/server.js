import { createServer } from 'node:http';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { openDatabase } from './db/database.js';
import { createMailer } from './mail/mailer.js';
import { startOutboxWorker } from './mail/outbox.js';

const config = loadConfig();
const db = openDatabase(config.databasePath);
const mailer = createMailer(config.mail);
const clock = () => new Date();

const server = createServer(createApp({ db, mailer, config, clock }));
const stopWorker = startOutboxWorker({ db, mailer, clock, log: console });

server.listen(config.port, () => {
  console.info(`tenant-notes listening on http://localhost:${config.port}`);
});

const shutdown = () => {
  stopWorker();
  server.close(() => {
    db.close();
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
