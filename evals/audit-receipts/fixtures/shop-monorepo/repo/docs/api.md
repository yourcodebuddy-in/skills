# API reference

All endpoints are under `/api` and speak JSON. Every request that isn't a `GET` must send
`Content-Type: application/json` (see [ADR 0004](adr/0004-csrf-without-tokens.md)). Amounts are
integer cents.

Errors look like this, with the HTTP status matching the kind of problem:

```json
{ "error": { "code": "out_of_stock", "message": "There isn't enough stock for this item", "details": { "productId": 3 } } }
```

| Status | Meaning |
| --- | --- |
| 400 | The request is malformed or a field is invalid (`invalid_request`, `invalid_json`) |
| 401 | Not signed in (`unauthenticated`, `invalid_credentials`) |
| 403 | Signed in, but not staff (`forbidden`) |
| 404 | No such thing, or it isn't yours (`not_found`) |
| 409 | The request conflicts with the current state (`out_of_stock`, `cart_empty`, `invalid_status`, …) |
| 415 | Not JSON (`unsupported_media_type`) |
| 422 | A discount code can't be used (`coupon_invalid`, `coupon_expired`, `coupon_used_up`, `coupon_minimum`) |
| 502 | The payment provider failed (`payment_unavailable`, `payment_provider_error`) |

## Account

| Request | Body | Notes |
| --- | --- | --- |
| `POST /api/account/register` | `email`, `name`, `password` (10+ characters) | Signs the new account in |
| `POST /api/account/login` | `email`, `password` | Sets the `sid` cookie |
| `POST /api/account/logout` | | Ends the session; `204` |
| `GET /api/account/me` | | The signed-in user |

## Catalogue

`GET /api/products?q=&sort=&page=` lists listed products, 24 a page. `sort` is one of `newest`
(the default), `price_asc`, `price_desc` or `name`; anything else means `newest`. `q` searches
names.

`GET /api/products/:id` returns one listed product.

## Cart

Signed-in shoppers only.

| Request | Body | Notes |
| --- | --- | --- |
| `GET /api/cart` | | Lines, item count and subtotal |
| `POST /api/cart/items` | `productId`, `quantity` (default 1), `priceCents` | Adds to the line if the product is already in the cart. `priceCents` is the price the shopper was shown, which the cart keeps |
| `PATCH /api/cart/items/:productId` | `quantity` (1 to 10) | |
| `DELETE /api/cart/items/:productId` | | |

## Checkout

| Request | Body | Notes |
| --- | --- | --- |
| `POST /api/checkout/quote` | `couponCode`, `country` (default `US`) | Totals for the current cart, without placing an order |
| `POST /api/checkout` | `shipping` (`name`, `line1`, `line2`, `city`, `postcode`, `country`), `couponCode`, `note` (up to 500 characters) | Places the order and returns it with `payment.intentId`; `201` |

## Orders

| Request | Notes |
| --- | --- |
| `GET /api/orders` | The shopper's orders, newest first |
| `GET /api/orders/:number` | One of the shopper's orders |
| `POST /api/orders/:number/cancel` | Only while awaiting payment |

## Payments

`POST /api/webhooks/payments` receives the provider's events. It needs no session; the
`FakePay-Signature` header (`t=<unix seconds>,v1=<hex HMAC-SHA256 of "t.body">`) must match
`PAYMENT_WEBHOOK_SECRET` and be no more than five minutes old. Handled events:

- `payment.succeeded`: marks the order paid. The amount must equal the order total.
- `payment.failed`: logged; the order stays awaiting payment so the shopper can try again.

Outside production, `POST /api/dev/payments/:intentId/pay` and `…/decline` stand in for the
provider's payment page.

## Staff

All need a staff account.

| Request | Body / query | Notes |
| --- | --- | --- |
| `GET /api/admin/orders` | `status`, `page` | 50 a page, newest first |
| `GET /api/admin/orders/:number` | | With customer, refunds and `refundableCents` |
| `POST /api/admin/orders/:number/fulfil` | | Paid orders only; emails the customer |
| `POST /api/admin/orders/:number/refund` | `amountCents` | Up to what's left to refund |
| `GET /api/admin/products` | `page` | Includes unlisted products and stock |
| `POST /api/admin/products` | `sku`, `name`, `description`, `priceCents`, `stock`, `active` | |
| `PATCH /api/admin/products/:id` | any of the above | |
| `GET /api/admin/coupons` | | |
| `POST /api/admin/coupons` | `code`, `percentOff` or `amountOffCents`, `minSubtotalCents`, `maxRedemptions`, `expiresOn` | `expiresOn` is the last day the code works |
| `GET /api/admin/reports/sales` | `from`, `to` (dates, inclusive) | Paid, refunded and net per UTC day; up to 366 days |
