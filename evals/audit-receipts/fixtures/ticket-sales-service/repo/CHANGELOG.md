# Changelog

## 0.9.0

- Organisers can refund some of an order's tickets; the seats go back on sale.
- Refunds made in the payment provider's dashboard are recorded from its webhook.
- The sales report groups orders by the organiser's local day.

## 0.8.0

- Cancelling an event refunds every paid order in full through the worker.
- CSV export of an event's orders.
- `tickets:resend` and `mail:retry` commands.

## 0.7.0

- Email moved to an outbox delivered by the worker (ADR 0003).
- Declined cards can be retried while the hold lasts.

## 0.6.0

- First version used by Harbour Hall: events, tiers, holds, checkout, tickets by email.
