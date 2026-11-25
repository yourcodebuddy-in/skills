# @kettle/core

The shop's rules, with no HTTP and no SQL.

- `pricing.js`: `quote({ lines, coupon, country })` works out subtotal, discount, shipping, tax and total.
- `cart.js`: what may be added to a cart, and a cart's summary.
- `coupons.js`: whether a code applies, and how much it takes off.
- `orders.js`: placing, paying, cancelling, shipping and refunding orders, and which status can follow which.
- `validate.js`: parsers for request input. Each returns a clean value or throws `ValidationError`.
- `money.js`, `dates.js`, `constants.js`, `errors.js`: the small pieces the rest share.

Functions that change data take a `store` from `@kettle/db` and do their writes inside
`store.transaction()`.
