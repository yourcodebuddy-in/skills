import assert from 'node:assert/strict';
import { test } from 'node:test';
import { eventCancelledEmail, refundEmail, ticketsEmail } from '../src/mail/templates.js';

const event = { title: 'Jazz & Blues <Live>', venue: 'Harbour Hall', starts_at: '2026-06-12T19:30:00.000Z' };

test('the tickets email lists every code and links to the order', () => {
  const message = ticketsEmail({
    order: { token: 'abc123', buyer_name: 'Ada', buyer_email: 'ada@example.test', quantity: 2, total_cents: 5250, currency: 'EUR' },
    event,
    tier: { name: 'Standing' },
    tickets: [{ code: 'K7P2M9QX4R' }, { code: 'H3N8W2ZT6Y' }],
    publicUrl: 'https://tickets.example.test',
  });
  assert.equal(message.to, 'ada@example.test');
  assert.equal(message.subject, 'Your tickets for Jazz & Blues <Live>');
  assert.match(message.text, /2 x Standing, €52\.50 in total/);
  assert.match(message.text, /K7P2M9QX4R/);
  assert.match(message.text, /https:\/\/tickets\.example\.test\/orders\/abc123/);
  assert.match(message.html, /Jazz &amp; Blues &lt;Live&gt;/);
  assert.doesNotMatch(message.html, /<Live>/);
});

test('the refund email names the amount and the tickets', () => {
  const message = refundEmail({
    quantity: 1,
    amountCents: 2500,
    currency: 'EUR',
    buyerName: '<b>Bo</b>',
    buyerEmail: 'bo@example.test',
    eventTitle: 'Late Night Jazz',
  });
  assert.match(message.text, /We've refunded €25\.00 for 1 ticket to Late Night Jazz/);
  assert.match(message.html, /&lt;b&gt;Bo&lt;\/b&gt;/);
});

test('a provider refund without tickets says "your order"', () => {
  const message = refundEmail({
    quantity: 0,
    amountCents: 500,
    currency: 'EUR',
    buyerName: 'Bo',
    buyerEmail: 'bo@example.test',
    eventTitle: 'Late Night Jazz',
  });
  assert.match(message.text, /€5\.00 for your order/);
});

test('the cancellation email promises a full refund', () => {
  const message = eventCancelledEmail({ event, buyer: { name: 'Cy', email: 'cy@example.test' } });
  assert.equal(message.subject, 'Cancelled: Jazz & Blues <Live>');
  assert.match(message.text, /full refund, including the booking fee/);
});
