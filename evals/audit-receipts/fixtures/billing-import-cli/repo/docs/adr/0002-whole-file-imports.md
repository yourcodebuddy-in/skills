# 0002 Whole-file imports

- Status: Accepted
- Date: 2025-06-02

## Context

The importer used to skip bad rows, log them, and import the rest. In April 2025 a customer's metering export started writing quantities with a thousands separator (`41,250`). Every row over 999 was skipped, the file "imported", and the customer was under-billed for two months before anyone read the logs.

We looked at importing good rows and parking bad ones for review, but a parked row is easy to forget, and the customer then re-uploads a corrected file that overlaps the rows already imported.

## Decision

- A usage file is checked completely before anything is written.
- If any row is invalid, the whole file is refused. Nothing is written, not even a record that the file was seen, so the corrected file can be imported normally.
- The rows of an accepted file and the record of the import are written in one transaction.
- The command lists the problems (at most 20) so the customer can fix the file.

## Consequences

- One bad row delays a whole file. That's intended: a refused file gets noticed, a skipped row doesn't.
- Partial files never exist in the database, so a file is either fully billed or not billed at all.
