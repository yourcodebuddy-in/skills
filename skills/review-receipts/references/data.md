# Databases, migrations, data pipelines, ML

- **Migration on real data:** does it work on a table with existing rows, duplicates, and nulls? For example, a new required column with no default fails.
- **Locks and size:** will it block writes or time out at production size? Check the stated scale.
- **Deploy order:** can old code run against the new schema, and new code against the old, during rollout and rollback?
- **One source of truth:** what representation is canonical after this change? Do old fields, readers, or writers stay alive with no current need?
- **Backfill:** how does existing data reach the new form, and is that repeatable if it fails midway?
- **Invariants:** does the database enforce what callers rely on, such as uniqueness or foreign keys, when callers can race?
- **Atomicity:** are related writes in one transaction when they must be? Are affected-row counts and conflicts checked?
- **Queries:** do the actual filters and sort order have an index at this data size? Is ordering stable enough for pagination?
- **Joins and grouping:** can a join multiply rows and inflate a sum or count? Do inner joins silently drop rows? Do nulls change a result?
- **Reruns:** is a pipeline safe to rerun and to backfill? Does it handle late, duplicate, or out-of-order data?
- **Time and units:** are time zones, day boundaries, currency, and precision handled consistently? Does a float hold money?
- **Schema drift:** what happens when an upstream column changes or goes missing?
- **ML leakage:** does test or future data influence training, preprocessing, or feature creation? Fit transforms on the training split only.
- **ML evaluation:** is the split right for the data, such as by time or by user? Does training and serving preprocessing match? Are seeds, versions, and metrics recorded?
