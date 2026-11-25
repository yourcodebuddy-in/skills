import { findUserByEmail } from '../auth/accounts.js';
import { requireRole, requireUser } from '../auth/guard.js';
import { TEAM_NAME_MAX } from '../constants.js';
import { badRequest, notFound } from '../http/errors.js';
import { json, noContent } from '../http/respond.js';
import { readEmail, readString } from '../lib/validate.js';
import { memberAddedEmail } from '../mail/templates.js';
import { ROLES, isRole } from '../teams/roles.js';
import {
  addMember,
  changeRole,
  createTeam,
  listMembers,
  listTeamsForUser,
  removeMember,
  renameTeam,
} from '../teams/teams.js';

const readRole = (value) => {
  if (!isRole(value)) {
    throw badRequest(`role must be one of: ${ROLES.join(', ')}`);
  }
  return value;
};

const readTeamName = (value) => readString(value, 'name', { max: TEAM_NAME_MAX });

export function registerTeamRoutes(router, { db, mailer, config }) {
  router.add('GET', '/teams', (ctx) => {
    const user = requireUser(ctx);
    return json(200, { teams: listTeamsForUser(db, user.id) });
  });

  router.add('POST', '/teams', async (ctx) => {
    const user = requireUser(ctx);
    const body = await ctx.body();
    const team = createTeam(db, { name: readTeamName(body.name), ownerId: user.id, now: ctx.now });
    return json(201, team);
  });

  router.add('PATCH', '/teams/:teamId', async (ctx) => {
    const user = requireUser(ctx);
    const { teamId } = ctx.params;
    requireRole(db, teamId, user.id, 'owner');
    const body = await ctx.body();
    return json(200, renameTeam(db, teamId, readTeamName(body.name)));
  });

  router.add('GET', '/teams/:teamId/members', (ctx) => {
    const user = requireUser(ctx);
    const { teamId } = ctx.params;
    requireRole(db, teamId, user.id, 'viewer');
    return json(200, { members: listMembers(db, teamId) });
  });

  router.add('POST', '/teams/:teamId/members', async (ctx) => {
    const user = requireUser(ctx);
    const { teamId } = ctx.params;
    requireRole(db, teamId, user.id, 'owner');
    const body = await ctx.body();
    const email = readEmail(body.email);
    const role = readRole(body.role ?? 'editor');

    const invitee = findUserByEmail(db, email);
    if (!invitee) {
      throw notFound('No account uses that email yet. Ask them to sign up first.');
    }
    const team = addMember(db, { teamId, userId: invitee.id, role, now: ctx.now });
    await mailer.send(
      memberAddedEmail({
        to: invitee.email,
        inviterName: user.name,
        teamName: team.name,
        role,
        url: `${config.publicUrl}/teams/${teamId}`,
      }),
    );
    return json(201, { userId: invitee.id, role });
  });

  router.add('PATCH', '/teams/:teamId/members/:userId', async (ctx) => {
    const user = requireUser(ctx);
    const { teamId, userId } = ctx.params;
    requireRole(db, teamId, user.id, 'owner');
    const body = await ctx.body();
    return json(200, changeRole(db, { teamId, userId, role: readRole(body.role) }));
  });

  router.add('DELETE', '/teams/:teamId/members/:userId', (ctx) => {
    const user = requireUser(ctx);
    const { teamId, userId } = ctx.params;
    requireRole(db, teamId, user.id, userId === user.id ? 'viewer' : 'owner');
    removeMember(db, { teamId, userId });
    return noContent();
  });
}
