# Architecture

## Pieces

```text
browser ──fetch──▶ apps/api ──▶ packages/core ──▶ packages/db ──▶ SQLite file
   ▲                   │
   └── apps/web ◀──────┘ (static files)
                       └──▶ packages/payments ──▶ provider (FakePay)
provider ──signed webhook──▶ apps/api
```

- **apps/api** parses requests, checks who is signed in, calls core, and shapes responses
  (`src/serialize.js` decides what each audience sees). Routes live in `src/routes/`, one file
  per area.
- **packages/core** holds the shop's rules: what a cart may contain, how a total is worked out,
  which order statuses can follow which, when a coupon applies. It reads and writes only through
  the store it's handed, so its tests can use an in-memory database.
- **packages/db** owns the schema and the SQL. `createStore(db)` returns one repository per table
  and a `transaction()` helper.
- **packages/payments** wraps the card provider. FakePay keeps the provider's shapes (intents,
  charges, refunds, signed webhooks) in memory.
- **apps/web** is static HTML with ES modules. Pure rendering functions (`views.js`,
  `admin-views.js`, `cart-summary.js`) are kept apart from the scripts that touch the DOM, so they
  can be tested in Node.

## Order lifecycle

```text
pending_payment ──▶ paid ──▶ fulfilled
      │              │           │
      ▼              └──────▶ refunded ◀─┘
  cancelled
```

1. **Checkout** (`placeOrder`) runs in one transaction: read the cart, check the coupon, price the
   order, take stock, count the coupon use, write the order and its items, empty the cart.
2. The API then creates a **payment intent** for the order total and stores its id on the order.
   If the provider refuses, the order is cancelled, which puts the stock and the coupon use back.
3. When the shopper pays, the provider sends **`payment.succeeded`**. `markOrderPaid` checks the
   amount, sets the order to `paid`, records the payment and queues the confirmation email.
4. Staff **ship** the order (`fulfilOrder`), which queues the shipping email.
5. Staff can **refund** a paid or shipped order in one or more parts, up to what was paid. When
   nothing is left to refund, the order becomes `refunded`.
6. A shopper can **cancel** an order while it's awaiting payment. The intent is cancelled at the
   provider first. Orders still awaiting payment after 30 minutes are cancelled the same way by
   the background worker.

## Prices

A cart line stores the unit price alongside the quantity, so the cart a shopper is looking at
doesn't change under them, and the order items record the price that was charged. Totals are
worked out by `quote()` in `packages/core/src/pricing.js`: subtotal, then discount, then shipping
and tax on what's left.

## Sessions and staff

Signing in creates a row in `sessions` and sets an `HttpOnly`, `SameSite=Strict` cookie. Every
API request looks the session up, so signing out works at once. Staff are users with
`role = 'admin'`; admin routes are declared with `{ auth: "admin" }` and the router checks the role
before the handler runs.

## Emails

Changes that should email a customer write a row to `outbox` in the same transaction. The worker
started by `server.js` (`src/worker.js`) sends pending rows every few seconds, retrying a failed
one up to five times. On the same tick it cancels unpaid orders and deletes expired sessions.
