// One failed send in a batch leaves the earlier, already delivered rows unmarked, so they go out again.
import { check, load } from './support/harness.mjs';

const { openDatabase } = await load('src/db/database.js');
const { deliverPending, enqueueEmail } = await load('src/mail/outbox.js');

const db = openDatabase(':memory:');
const now = new Date('2026-03-02T07:00:00.000Z');
for (const to of ['a@example.com', 'b@example.com', 'c@example.com']) {
  enqueueEmail(db, { to, subject: 'Your daily digest', text: 'x' }, { kind: 'digest', dedupeKey: `digest:${to}`, now });
}

const delivered = [];
let failNext = true;
const mailer = {
  async send(message) {
    if (message.to === 'c@example.com' && failNext) {
      failNext = false;
      throw new Error('socket hang up');
    }
    delivered.push(message.to);
    return { id: String(delivered.length) };
  },
};

let firstRun = 'ok';
try {
  await deliverPending(db, mailer, { now });
} catch (error) {
  firstRun = `threw: ${error.message}`;
}
const secondRun = await deliverPending(db, mailer, { now });
db.close();

const count = (to) => delivered.filter((value) => value === to).length;
console.log({ firstRun, secondRun, delivered });
check(
  count('a@example.com') === 2 && count('b@example.com') === 2 && count('c@example.com') === 1,
  'a and b each received the same digest twice because one later send in the batch failed',
);
