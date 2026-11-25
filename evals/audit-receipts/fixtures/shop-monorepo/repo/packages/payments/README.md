# @kettle/payments

The payment provider adapter and webhook signatures.

```js
const payments = createPaymentProvider("fakepay", { webhookSecret, deliver });
const intent = await payments.createIntent({ amountCents: 4496, reference: "SO-ABCD2345" });
```

## FakePay

An in-process stand-in for the card provider, with the same shapes: intents, charges, refunds and
signed webhooks. `deliver({ body, signature })` is how it sends a webhook; it should resolve
`true` when the receiver answered 2xx. Like the real provider, FakePay delivers each event at
least once: it retries a delivery that wasn't accepted, up to three attempts, so the same event
can arrive more than once.

Webhooks carry a `FakePay-Signature` header, `t=<unix seconds>,v1=<signature>`, where the
signature is the hex HMAC-SHA256 of `"<t>.<body>"` with the webhook secret. `verifyWebhook`
checks it in constant time and refuses timestamps more than five minutes from now.
