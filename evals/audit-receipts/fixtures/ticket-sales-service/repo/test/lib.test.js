import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toCsv } from '../src/lib/csv.js';
import { bookingFee, formatMoney } from '../src/lib/money.js';
import { localDateTime, localDay } from '../src/lib/time.js';
import { escapeHtml } from '../src/mail/templates.js';
import { sign, verifySignature } from '../src/payments/webhook.js';

test('booking fees round to the nearest cent', () => {
  assert.equal(bookingFee(2500, 500), 125);
  assert.equal(bookingFee(1990, 500), 100);
  assert.equal(bookingFee(1970, 500), 99);
  assert.equal(bookingFee(0, 500), 0);
});

test('money is shown with two decimals and the currency symbol', () => {
  assert.equal(formatMoney(2500), '€25.00');
  assert.equal(formatMoney(1205, 'GBP'), '£12.05');
  assert.equal(formatMoney(99, 'USD'), '$0.99');
  assert.equal(formatMoney(150, 'CHF'), 'CHF 1.50');
});

test('local days and times follow the time zone', () => {
  assert.equal(localDay('2026-03-29T00:30:00Z', 'Europe/London'), '2026-03-29');
  assert.equal(localDay('2026-07-01T23:30:00Z', 'Europe/London'), '2026-07-02');
  assert.equal(localDay('2026-07-01T03:00:00Z', 'America/New_York'), '2026-06-30');
  assert.equal(localDateTime('2026-07-01T23:30:00Z', 'Europe/Berlin'), '2026-07-02 01:30');
});

test('CSV cells are quoted when needed and formulas are neutralised', () => {
  const csv = toCsv(
    [
      { header: 'Name', value: (row) => row.name },
      { header: 'Amount', value: (row) => row.amount },
    ],
    [
      { name: 'Plain', amount: 1 },
      { name: 'Comma, Name', amount: 2 },
      { name: 'Say "hi"', amount: 3 },
      { name: '=HYPERLINK("x")', amount: -4 },
    ],
  );
  assert.equal(
    csv,
    'Name,Amount\r\nPlain,1\r\n"Comma, Name",2\r\n"Say ""hi""",3\r\n"\'=HYPERLINK(""x"")",-4\r\n',
  );
});

test('HTML is escaped', () => {
  assert.equal(escapeHtml(`<a href="x">Tom & 'Jerry'</a>`), '&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/a&gt;');
});

test('webhook signatures are checked against the secret', () => {
  const body = '{"type":"charge.refunded"}';
  assert.equal(verifySignature(body, sign(body, 'secret'), 'secret'), true);
  assert.equal(verifySignature(body, sign(body, 'other'), 'secret'), false);
  assert.equal(verifySignature(body, 'short', 'secret'), false);
  assert.equal(verifySignature(body, sign(body, ''), ''), false);
});
