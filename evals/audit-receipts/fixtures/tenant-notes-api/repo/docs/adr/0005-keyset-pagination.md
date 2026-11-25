# 5. Keyset pagination for note lists

Date: 2026-03-09
Status: accepted

## Context

Offset pagination skips or repeats notes when someone adds or deletes a note while another person pages through the list, and it gets slower the deeper you go.

## Decision

Note lists are ordered by `id` descending. A page returns `nextCursor`, the id to continue from; the next request returns notes with an id below it. The server fetches one row more than the page size to know whether another page exists. The cursor is a plain id, not an opaque string, because ids are already visible in note URLs.

## Consequences

- Pages are stable while notes are added.
- Lists can't be sorted by title or date without a second cursor format. We'll add that when someone asks.
