# 2. Money in integer cents

Date: 2026-03-02
Status: accepted

## Context

Floating-point dollars drift: `19.99 * 100` is `1998.9999999999998`. A shop that adds, discounts
and taxes prices will show totals a cent off, and the payment provider rejects amounts that
aren't whole cents.

## Decision

- Every amount is an integer number of cents, in the database (`*_cents INTEGER` columns), in the
  API (fields named `…Cents`) and in all calculations.
- Rounding happens once, where a percentage is applied (`percentOf`, `basisPointsOf` in
  `packages/core/src/money.js`), to the nearest cent.
- Converting to and from dollars happens only at the edges a person sees: formatting for display,
  and reading what staff type into a price field.

## Consequences

- Totals add up exactly, and refunds can be compared to what was paid.
- Every input that carries money is checked to be a whole, non-negative number of cents.
