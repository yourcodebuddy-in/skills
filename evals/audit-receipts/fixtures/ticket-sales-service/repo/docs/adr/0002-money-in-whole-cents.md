# 0002. Money in whole cents, one currency per deployment

Date: 2025-11-04. Status: accepted.

## Context

Floating-point amounts drift: 0.1 + 0.2 is not 0.3, and a report that sums thousands of orders will
be a few cents out. All our organisers so far sell in one currency each.

## Decision

- Every amount is an integer number of cents (minor units): prices, fees, totals and refunds, in
  the database, in the API (fields end in `Cents`) and in calls to the payment provider.
- The booking fee is computed once per order from the subtotal, in basis points, rounded half up
  to a whole cent. It is stored on the order and never recomputed.
- A deployment sells in one currency, set by `CURRENCY`. An order stores it anyway, so a later
  change doesn't rewrite history.
- Amounts are turned into text only for people: emails, the report's `display` block and the CSV.

## Consequences

- Organisers selling in two currencies need two deployments.
- No currency conversion anywhere.
