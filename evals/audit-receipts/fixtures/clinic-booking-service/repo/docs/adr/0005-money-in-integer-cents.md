# 5. Money in integer cents

Date: 2025-10-06. Status: accepted.

## Context

Prices and fees are charged to patients' cards and exported to the finance team.

## Decision

- Amounts are stored, computed and sent to the payment provider as integer cents, with the currency alongside. No floats anywhere on the money path.
- A percentage of an amount is rounded half up to the cent, in one function (`fees.percent_of`).
- A booking keeps the price it was made at, so changing a practitioner's price doesn't change existing bookings or their fees.
- Amounts are shown to patients as dollars and cents by `formatting.format_money`; the CSV export keeps cents.

## Consequences

- Finance gets exact figures, and a fee always equals what the provider was asked to charge.
