# API

All request and response bodies are JSON unless noted. Errors look like `{ "error": "message" }` with a matching status code. Every endpoint except registration, login and `/s/:token` needs a session, sent as the `sid` cookie or as `Authorization: Bearer <token>`.

## Accounts

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| `POST` | `/auth/register` | `{ email, name, password }` | `201 { user, token, expiresAt }` and a `sid` cookie |
| `POST` | `/auth/login` | `{ email, password }` | `200 { user, token, expiresAt }` and a `sid` cookie |
| `POST` | `/auth/logout` | | `204`, clears the cookie |
| `GET` | `/me` | | `{ user, teams }` |
| `PATCH` | `/me` | `{ digest: boolean }` | `{ digest }` |

Passwords are 10 to 200 characters. Registering an email that already has an account returns `409`. A wrong password and an unknown email return the same `401`.

## Teams

| Method | Path | Role | Body | Returns |
| --- | --- | --- | --- | --- |
| `GET` | `/teams` | | | `{ teams: [{ id, name, role, createdAt }] }` |
| `POST` | `/teams` | | `{ name }` | `201 { id, name, role, createdAt }` |
| `PATCH` | `/teams/:teamId` | owner | `{ name }` | the team |
| `GET` | `/teams/:teamId/members` | viewer | | `{ members: [{ id, name, email, role, joinedAt }] }` |
| `POST` | `/teams/:teamId/members` | owner | `{ email, role? }` | `201 { userId, role }` |
| `PATCH` | `/teams/:teamId/members/:userId` | owner | `{ role }` | `{ userId, role }` |
| `DELETE` | `/teams/:teamId/members/:userId` | owner, or yourself | | `204` |

`role` is `viewer`, `editor` or `owner`, and defaults to `editor` when adding someone. The person must already have an account; if not, the response is `404`. Adding someone who is already in the team returns `409`. Removing or demoting the last owner returns `409`.

## Notes

| Method | Path | Role | Body | Returns |
| --- | --- | --- | --- | --- |
| `GET` | `/teams/:teamId/notes` | viewer | | `{ notes, nextCursor }` |
| `POST` | `/teams/:teamId/notes` | editor | `{ title, body, tags? }` | `201` note |
| `GET` | `/teams/:teamId/notes/:noteId` | viewer | | note |
| `PATCH` | `/teams/:teamId/notes/:noteId` | editor | any of `{ title, body, tags }` | note |
| `DELETE` | `/teams/:teamId/notes/:noteId` | editor | | `204` |

A note looks like:

```json
{
  "id": 12,
  "teamId": "4f0c…",
  "authorId": "9a1e…",
  "title": "On-call rota",
  "body": "Weekly, Monday to Monday.",
  "tags": ["ops", "rota"],
  "createdAt": "2026-03-02T09:00:00.000Z",
  "updatedAt": "2026-03-02T09:00:00.000Z"
}
```

Sending `tags` on `PATCH` replaces the whole list; leaving it out keeps the current tags.

List query parameters:

| Parameter | Meaning |
| --- | --- |
| `limit` | Page size, 1 to 100, default 20 |
| `cursor` | The `nextCursor` from the previous page |
| `tag` | Only notes with this tag |
| `q` | Only notes whose title or body contains this text |

`nextCursor` is `null` on the last page.

## Share links

| Method | Path | Role | Body | Returns |
| --- | --- | --- | --- | --- |
| `POST` | `/teams/:teamId/notes/:noteId/shares` | editor | `{ expiresInDays? }` | `201 { id, url, expiresAt }` |
| `GET` | `/teams/:teamId/notes/:noteId/shares` | editor | | `{ shares: [{ id, createdBy, createdAt, expiresAt, revokedAt }] }` |
| `DELETE` | `/teams/:teamId/notes/:noteId/shares/:shareId` | editor | | `204` |
| `GET` | `/s/:token` | none | | HTML page |

`expiresInDays` is a whole number from 1 to 30 and defaults to 7. The `url` is the only time the token is shown. `/s/:token` returns a `404` page once the link has expired, been turned off, or its note has been deleted.

## Export

| Method | Path | Role | Returns |
| --- | --- | --- | --- |
| `GET` | `/teams/:teamId/export.csv?columns=` | viewer | `text/csv` download |

Columns: `id`, `title`, `body`, `tags`, `author`, `created_at`, `updated_at`. The default is `id,title,tags,author,updated_at`. An unknown column returns `400`.
