# Tenant Notes

A small API for teams to keep notes together. People sign up, create teams, add each other with a role, write tagged notes, share a single note with a link, export a team's notes as CSV, and get a daily digest email of what changed.

It runs on Node's standard library only: `node:http` for the server, `node:sqlite` for storage, `node:test` for tests. There is nothing to install.

## Running it

You need Node 24 or later.

```sh
cp .env.example .env
npm start
```

The server listens on `PORT` (3000 by default) and creates the SQLite file at `DATABASE_PATH` on first start. Migrations run on every start and are safe to repeat.

To queue the daily digest, run this once a day from cron:

```sh
npm run digest
```

The job only queues the emails. The running server delivers them from the outbox every 30 seconds (see [ADR 0004](docs/adr/0004-send-email-through-outbox.md)). The job queues at most one digest per person per day, however many times it runs.

## Configuration

| Variable | Default | What it does |
| --- | --- | --- |
| `PORT` | `3000` | Port for the HTTP server |
| `DATABASE_PATH` | `./data/notes.db` | SQLite file. The folder is created if it's missing |
| `PUBLIC_URL` | `http://localhost:3000` | Used to build share links and links in emails |
| `SESSION_DAYS` | `14` | How long a sign-in lasts |
| `COOKIE_SECURE` | `true` | Set to `false` only for local work over plain http |
| `MAIL_TRANSPORT` | `log` | `log` prints each email; `http` posts it to your mail provider |
| `MAIL_API_URL` | | Provider endpoint, needed for `http` |
| `MAIL_API_KEY` | | Provider key, sent as a bearer token, needed for `http` |
| `MAIL_FROM` | `Tenant Notes <notes@localhost>` | From address |

## How it works

### Accounts and sessions

`POST /auth/register` and `POST /auth/login` return a session token and also set it as an `HttpOnly` cookie, so browsers and API clients can both use it. API clients send it as `Authorization: Bearer <token>`. Passwords are hashed with scrypt. Sessions last `SESSION_DAYS` days and end on `POST /auth/logout`.

### Teams and roles

Whoever creates a team owns it. Owners add people by the email they signed up with, and each member has one role:

| Role | Can |
| --- | --- |
| `viewer` | Read notes, export CSV, see the member list |
| `editor` | Everything a viewer can, plus write and delete notes and manage share links |
| `owner` | Everything an editor can, plus rename the team and manage members |

A team always keeps at least one owner. Anyone can leave a team, except its last owner. If you ask for a team you're not in, you get a 404, the same as for a team that doesn't exist ([ADR 0002](docs/adr/0002-hide-teams-from-non-members.md)).

### Notes and tags

A note has a title (up to 200 characters), a body (up to 20,000) and up to 10 tags. Tags are stored lower-case with spaces turned into hyphens and a leading `#` dropped, so `#Road Map` is stored as `road-map`.

`GET /teams/:teamId/notes` lists notes newest first, 20 at a time (up to 100 with `limit`). Filter with `tag` and search titles and bodies with `q`. Follow `nextCursor` to get the next page ([ADR 0005](docs/adr/0005-keyset-pagination.md)).

Deleting a note deletes its tags and every share link to it, so an old link stops working as soon as the note is gone.

### Share links

Editors can make a read-only link to a single note. Anyone with the link can read the note without signing in. Share links last 7 days. Pass `expiresInDays`, from 1 to 30, to choose another length. A link can be turned off at any time, and the list of a note's links never shows the token again.

### CSV export

`GET /teams/:teamId/export.csv` downloads every note in the team. Choose columns with `columns`, for example `?columns=title,tags,updated_at`. Tags are separated by spaces. Cells that start like a spreadsheet formula are prefixed with `'` so they open as text.

### Email

All email goes through the outbox table. Two kinds go out today: the daily digest and the note telling someone they were added to a team.

## API reference

See [docs/api.md](docs/api.md).

## Development

```sh
npm test
```

Tests start the app on a random port with an in-memory database and a mailer that keeps messages in memory. Nothing touches the network.

The code is laid out by feature. [docs/architecture.md](docs/architecture.md) explains the request flow and the background work, and [docs/adr](docs/adr) holds the decisions behind it. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.
