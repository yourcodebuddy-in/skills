# 0001 Money in integer cents

- Status: Accepted
- Date: 2025-03-11

## Context

The first prototype priced usage with floats. Two invoices for the same usage came out a cent apart depending on the order lines were added, and finance couldn't reconcile them with the accounting system.

## Decision

- Every stored amount is an integer number of cents.
- Prices per unit can be fractional cents (an API call costs 0.05 cents), so arithmetic before rounding uses `decimal.Decimal`, built from strings, never from floats.
- A line is rounded to whole cents exactly once, half up, with `money.to_cents`. Subtotals and totals are sums of already rounded lines. Tax is a percentage of the rounded taxable amount, rounded the same way.
- Nothing else rounds money.

## Consequences

- Line amounts on an invoice always add up to its subtotal.
- Quantities are stored as text so `Decimal` reads them back exactly.
