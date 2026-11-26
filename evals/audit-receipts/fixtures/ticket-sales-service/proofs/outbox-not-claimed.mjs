// The worker reads pending outbox rows and marks them sent only after sending, with no claim in
// between. Two workers (ADR 0001 says run one; nothing stops a second) send every email twice.
// The jobs table, by contrast, is claimed with a conditional update.
import { join } from 'node:path';
import { check, fakeClock, fakeMailer, load, makeApp, tempDir } from './lib.mjs';

const dbPath = join(tempDir(), 'shared.db');
const mailer = fakeMailer({ delayMs: 20 });
const first = await makeApp({ dbPath, mailer, clock: fakeClock() });
const second = await makeApp({ dbPath, mailer, clock: fakeClock(), migrate: false });
const { enqueueMail } = await load('src/mail/outbox.js');
const { deliverMail } = await load('src/worker/deliver-mail.js');

for (const to of ['a@example.test', 'b@example.test']) {
  enqueueMail(first.ctx.db, { kind: 'tickets', to, subject: 'Your tickets', text: 't', html: 'h' });
}
await Promise.all([deliverMail(first.ctx), deliverMail(second.ctx)]);
check(mailer.sent.length === 4, `two workers sent ${mailer.sent.length} emails for 2 queued messages`);
check(mailer.sent.filter((message) => message.to === 'a@example.test').length === 2, 'the same buyer got the same email twice');
