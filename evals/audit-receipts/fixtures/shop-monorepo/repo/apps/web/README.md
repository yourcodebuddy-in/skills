# @kettle/web

Static pages served by the API: the storefront (`/`), cart, checkout, account and admin.

Each page loads one script from `public/js`. Scripts that touch the DOM (`storefront.js`,
`cart.js`, `checkout.js`, `account.js`, `admin.js`) build their HTML with the pure modules
(`views.js`, `admin-views.js`, `cart-summary.js`, `format.js`, `escape.js`), which the tests in
`test/` run in Node.
