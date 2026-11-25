# Contributing

## Setup

You need Python 3.12 or later and nothing else.

```sh
python3 -m unittest discover -s tests
```

## Making a change

1. Branch from `main`.
2. Keep billing rules in `pricing.py`, `discounts.py`, `tax.py` and `money.py`, and SQL in `repository.py`.
3. Add or update tests in `tests/`. Use `tests/helpers.py` for a temporary database and sample plans; tests never use the network.
4. If the change sets a pattern other code will follow, add a decision record in `docs/adr/`.
5. Update `README.md` when a command, option or setting changes.

## Schema changes

Add a new entry at the end of `MIGRATIONS` in `usagebill/migrations.py`. Never edit a migration that has shipped. SQLite can't alter most column definitions, so changing a table means creating a new one, copying the rows, dropping the old one and renaming.

## Review

Pull requests are reviewed as described in `docs/REVIEWING.md`.
