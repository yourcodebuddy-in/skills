import { once } from 'node:events';
import { createServer } from 'node:http';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { openDatabase } from '../src/db/database.js';

export const PASSWORD = 'correct horse battery';
export const START = new Date('2026-03-02T09:00:00.000Z');

export const quietLog = { info() {}, warn() {}, error() {} };

export function memoryMailer() {
  const sent = [];
  return {
    sent,
    async send(message) {
      sent.push(message);
      return { id: `msg-${sent.length}` };
    },
  };
}

function createClient(base) {
  let token = null;

  const request = async (method, path, body) => {
    const headers = {};
    if (token) {
      headers.authorization = `Bearer ${token}`;
    }
    if (body !== undefined) {
      headers['content-type'] = 'application/json';
    }
    const response = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const type = response.headers.get('content-type') ?? '';
    const parsed = type.includes('application/json') ? await response.json() : await response.text();
    return { status: response.status, body: parsed, headers: response.headers };
  };

  return {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    patch: (path, body) => request('PATCH', path, body),
    delete: (path) => request('DELETE', path),
    useToken(value) {
      token = value;
    },
  };
}

export async function startApp(t, { mailer = memoryMailer() } = {}) {
  const db = openDatabase(':memory:');
  const config = loadConfig({ PUBLIC_URL: 'http://notes.test', COOKIE_SECURE: 'false' });
  const clock = { now: START };
  const app = createApp({ db, mailer, config, clock: () => clock.now, log: quietLog });

  const server = createServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;

  t.after(() => {
    server.closeAllConnections();
    server.close();
    db.close();
  });

  const signUp = async (email, name = email.split('@')[0]) => {
    const client = createClient(base);
    const res = await client.post('/auth/register', { email, name, password: PASSWORD });
    if (res.status !== 201) {
      throw new Error(`sign up failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
    }
    client.useToken(res.body.token);
    client.user = res.body.user;
    return client;
  };

  return { db, mailer, config, clock, base, client: () => createClient(base), signUp };
}

export async function teamWithMember(app, role) {
  const owner = await app.signUp('owner@example.com', 'Olu');
  const member = await app.signUp(`${role}@example.com`, `Sam ${role}`);
  const { body: team } = await owner.post('/teams', { name: 'Platform' });
  await owner.post(`/teams/${team.id}/members`, { email: `${role}@example.com`, role });
  return { owner, member, team };
}
