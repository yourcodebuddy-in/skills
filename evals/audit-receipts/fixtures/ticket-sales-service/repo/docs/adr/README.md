# Decision records

Short records of decisions that shape the code, so nobody has to rediscover why. Add one before
introducing a pattern other code will copy. Number them in order and never reuse a number; if a
decision changes, write a new record that supersedes the old one.

| Number | Decision |
| --- | --- |
| [0001](0001-sqlite-on-one-host.md) | SQLite on one host, with one worker |
| [0002](0002-money-in-whole-cents.md) | Money in whole cents, one currency per deployment |
| [0003](0003-email-through-an-outbox.md) | Email goes through an outbox |
| [0004](0004-buyers-reach-orders-by-link.md) | Buyers reach their holds and orders by link, without accounts |
| [0005](0005-holds-end-in-the-worker.md) | Holds end in the worker, not when read |
