// When the mail transport fails, the outbox row is still marked sent, so the tickets email is never
// retried and mail:retry can't find it.
import { addOrganiser, buy, check, load, makeApp, onSaleEvent } from './lib.mjs';

const mailer = {
  calls: 0,
  async send() {
    mailer.calls += 1;
    throw new Error('mail provider answered 503');
  },
};
const { ctx, call } = await makeApp({ mailer });
const { deliverMail } = await load('src/worker/deliver-mail.js');
const { retryFailedMail } = await load('src/mail/outbox.js');
const { key } = await addOrganiser(ctx, 'harbour-hall');
const { eventId, tierIds } = await onSaleEvent(call, key);
await buy(call, eventId, tierIds[0]);

const result = await deliverMail(ctx);
check(result.attempted === 1 && result.sent === 0, 'the only send attempt failed');
const row = ctx.db.prepare("SELECT * FROM outbox WHERE kind = 'tickets'").get();
check(row.status === 'sent' && row.sent_at !== null, `the tickets email is recorded as sent (status ${row.status})`);

await deliverMail(ctx);
check(mailer.calls === 1, 'later worker runs never try it again');
check(retryFailedMail(ctx.db) === 0, 'mail:retry finds nothing to retry');
