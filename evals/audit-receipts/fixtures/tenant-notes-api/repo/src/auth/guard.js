import { forbidden, notFound, unauthorized } from '../http/errors.js';
import { roleAtLeast } from '../teams/roles.js';

export function requireUser(ctx) {
  if (!ctx.user) {
    throw unauthorized();
  }
  return ctx.user;
}

// People outside the team get a 404, not a 403: see docs/adr/0002.
export function requireRole(db, teamId, userId, minimum) {
  const membership = db
    .prepare('SELECT role FROM memberships WHERE team_id = ? AND user_id = ?')
    .get(teamId, userId);
  if (!membership) {
    throw notFound('Team not found');
  }
  if (!roleAtLeast(membership.role, minimum)) {
    throw forbidden(`This needs the ${minimum} role or higher`);
  }
  return membership.role;
}
