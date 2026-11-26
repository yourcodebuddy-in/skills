# API

JSON in and out. Errors look like `{ "error": "code", ...details }` with a fitting status:
`400` bad JSON, `401` bad or missing key, `404` not found (including another organiser's data),
`409` a state conflict, `410` an expired hold, `422` invalid field (`field` and `reason` say which).

## Organiser endpoints

All need `Authorization: Bearer <api key>`.

### Events

`POST /events`

```json
{
  "title": "Late Night Jazz",
  "venue": "Harbour Hall",
  "startsAt": "2026-06-12T19:30:00Z",
  "tiers": [
    { "name": "Standing", "priceCents": 2500, "capacity": 100 },
    { "name": "Balcony", "priceCents": 4000, "capacity": 20 }
  ]
}
```

`startsAt` needs a UTC offset. Up to 12 tiers. Prices are whole cents from 50 (the payment
provider's smallest charge) to 1,000,000. Creates a draft.

- `GET /events`: the organiser's events, soonest first.
- `GET /events/:id`
- `PATCH /events/:id`: change `title`, `venue` or `startsAt`. Not after cancelling.
- `POST /events/:id/publish`: puts a draft on sale. Refused for events in the past.
- `POST /events/:id/cancel`: stops sales, releases open holds, tells every buyer and queues a full
  refund of every paid order. Returns the event and how many buyers were told.

### Tiers

- `POST /events/:id/tiers`: add a tier, same fields as above.
- `PATCH /events/:id/tiers/:tierId`: change `name`, `priceCents` or `capacity`. A new price applies
  to holds made afterwards; buyers already holding or holding paid tickets keep their price.
  Capacity can't go below the seats sold and held.

### Orders and refunds

`GET /events/:id/orders` lists orders, 50 a page.

| Query | Values |
| --- | --- |
| `status` | `pending`, `charging`, `paid`, `failed`, `refunded` |
| `sort` | `created` (default), `paid`, `total`, `buyer`, `quantity` |
| `dir` | `desc` (default) or `asc` |
| `page` | from 1 |

`POST /events/:id/orders/:orderToken/refunds` with `{ "quantity": 1 }` refunds that many of the
order's tickets at the ticket price. The booking fee is kept. The refunded tickets are voided and
their seats go back on sale. When every ticket is refunded the order becomes `refunded`.

### Reports

`GET /events/:id/report`

```json
{
  "event": { "id": 4, "title": "Late Night Jazz", "status": "on_sale" },
  "tiers": [{ "id": 7, "name": "Standing", "capacity": 100, "sold": 41 }],
  "orders": 23,
  "grossCents": 107625,
  "refundedCents": 5000,
  "netCents": 102625,
  "display": { "gross": "€1076.25", "refunded": "€-50.00", "net": "€1026.25" },
  "byDay": [{ "day": "2026-05-01", "orders": 9, "tickets": 15 }]
}
```

`sold` counts tickets not refunded. `byDay` groups paid orders by the day they were paid on in the
organiser's time zone.

`GET /events/:id/orders.csv` downloads paid and refunded orders: order, paid at (organiser's time
zone), name, email, tier, tickets, refunded tickets, total, status.

## Buyer endpoints

No authentication. Hold and order tokens are the buyer's access (ADR 0004).

- `GET /public/:organiserSlug/events`: on-sale events that haven't started, with `remaining` seats
  per tier.
- `POST /public/events/:id/holds` with `{ "tierId": 7, "quantity": 2, "email": "...", "name": "..." }`.
  Returns `{ hold: { token, expiresAt, unitPriceCents, ... } }`. `409 not_enough_seats` says how
  many are `available`. `quantity` is limited by `MAX_TICKETS_PER_HOLD`.
- `GET /holds/:token`
- `DELETE /holds/:token`: gives the seats back. `409` once a payment has started.
- `POST /holds/:token/checkout` with `{ "paymentToken": "tok_..." }`. Returns the paid order with
  its tickets. `402 payment_declined` with a `reason` when the card is declined; the buyer can try
  again with another card while the hold lasts. `502 payment_unavailable` when the provider can't
  be reached; trying again is safe.
- `GET /orders/:token`: the order and its tickets.

## Webhooks

`POST /webhooks/payments`, signed by the provider: the `x-payments-signature` header is the hex
HMAC-SHA256 of the raw body with `PAYMENTS_WEBHOOK_SECRET`.

Only `charge.refunded` is acted on:

```json
{ "type": "charge.refunded", "data": { "paymentId": "ch_...", "refundId": "re_...", "amountCents": 2500, "full": false } }
```

It records a refund made outside the service, for example in the provider's dashboard. A full
refund voids the order's tickets. Refunds the service made itself are recognised by `refundId` and
not recorded twice. Other event types get `202`.

## Health

`GET /healthz` returns `{ "ok": true }`.
