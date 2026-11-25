# 2. People outside a team get 404, not 403

Date: 2026-01-19
Status: accepted

## Context

Team ids appear in URLs that people paste into chat and tickets. A `403` for someone outside the team confirms that the team exists, and a `403` versus `404` difference lets anyone check which ids are real.

## Decision

`requireRole` returns `404 Team not found` when the caller isn't a member, whatever they asked for. Members who lack the role get `403`, because they already know the team exists.

## Consequences

Support can't tell "wrong id" from "not a member" from the response alone; they check the member list instead.
