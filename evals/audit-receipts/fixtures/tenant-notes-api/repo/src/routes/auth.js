import { authenticate, registerUser, setDigestPreference } from '../auth/accounts.js';
import { requireUser } from '../auth/guard.js';
import { createSession, endSession, tokenFromRequest } from '../auth/sessions.js';
import { clearedSessionCookie, sessionCookie } from '../http/cookies.js';
import { badRequest, unauthorized } from '../http/errors.js';
import { json, noContent } from '../http/respond.js';
import { readEmail, readName, readPassword } from '../lib/validate.js';
import { listTeamsForUser } from '../teams/teams.js';

export function registerAuthRoutes(router, { db, config }) {
  const startSession = (user, now, status) => {
    const session = createSession(db, user.id, { now, days: config.sessionDays });
    const cookie = sessionCookie(session.token, {
      expires: session.expiresAt,
      secure: config.cookieSecure,
    });
    return json(
      status,
      { user, token: session.token, expiresAt: session.expiresAt.toISOString() },
      { 'set-cookie': cookie },
    );
  };

  router.add('POST', '/auth/register', async (ctx) => {
    const body = await ctx.body();
    const user = await registerUser(db, {
      email: readEmail(body.email),
      name: readName(body.name),
      password: readPassword(body.password),
      now: ctx.now,
    });
    return startSession(user, ctx.now, 201);
  });

  router.add('POST', '/auth/login', async (ctx) => {
    const body = await ctx.body();
    if (typeof body.email !== 'string' || typeof body.password !== 'string') {
      throw badRequest('Send an email and a password');
    }
    const user = await authenticate(db, {
      email: body.email.trim().toLowerCase(),
      password: body.password,
    });
    if (!user) {
      throw unauthorized('That email and password do not match an account');
    }
    return startSession(user, ctx.now, 200);
  });

  router.add('POST', '/auth/logout', (ctx) => {
    endSession(db, tokenFromRequest(ctx.req));
    return noContent({ 'set-cookie': clearedSessionCookie(config.cookieSecure) });
  });

  router.add('GET', '/me', (ctx) => {
    const user = requireUser(ctx);
    return json(200, { user, teams: listTeamsForUser(db, user.id) });
  });

  router.add('PATCH', '/me', async (ctx) => {
    const user = requireUser(ctx);
    const body = await ctx.body();
    if (typeof body.digest !== 'boolean') {
      throw badRequest('digest must be true or false');
    }
    setDigestPreference(db, user.id, body.digest);
    return json(200, { digest: body.digest });
  });
}
