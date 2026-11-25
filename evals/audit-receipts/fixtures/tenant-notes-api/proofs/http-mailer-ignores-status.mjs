// The http mail transport never looks at the response status, so a rejected email is marked sent.
import { once } from 'node:events';
import { createServer } from 'node:http';
import { check, load } from './support/harness.mjs';

const { openDatabase } = await load('src/db/database.js');
const { createMailer } = await load('src/mail/mailer.js');
const { deliverPending, enqueueEmail } = await load('src/mail/outbox.js');

let requests = 0;
const provider = createServer((req, res) => {
  requests += 1;
  req.resume();
  res.writeHead(503, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: 'sending quota exceeded' }));
});
provider.listen(0, '127.0.0.1');
await once(provider, 'listening');

const mailer = createMailer({
  transport: 'http',
  url: `http://127.0.0.1:${provider.address().port}/send`,
  apiKey: 'test-key',
  from: 'notes@example.com',
});
const db = openDatabase(':memory:');
const now = new Date('2026-03-02T07:00:00.000Z');
enqueueEmail(db, { to: 'a@example.com', subject: 'Digest', text: 'x' }, { kind: 'digest', now });

const sent = await deliverPending(db, mailer, { now });
const row = db.prepare('SELECT sent_at, last_error, attempts FROM outbox').get();
db.close();
provider.close();

console.log({ requests, sent, row: { ...row } });
check(
  requests === 1 && sent === 1 && row.sent_at !== null && row.last_error === null,
  'the provider answered 503 but the email was recorded as sent and will never be retried',
);
