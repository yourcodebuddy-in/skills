import { isUniqueViolation, transaction } from '../db/transaction.js';
import { conflict, notFound } from '../http/errors.js';
import { newId } from '../lib/ids.js';
import { toIso } from '../lib/time.js';

export function createTeam(db, { name, ownerId, now }) {
  const team = { id: newId(), name, createdAt: toIso(now) };
  transaction(db, () => {
    db.prepare('INSERT INTO teams (id, name, created_at) VALUES (?, ?, ?)').run(
      team.id,
      team.name,
      team.createdAt,
    );
    db.prepare(
      "INSERT INTO memberships (team_id, user_id, role, created_at) VALUES (?, ?, 'owner', ?)",
    ).run(team.id, ownerId, team.createdAt);
  });
  return { ...team, role: 'owner' };
}

export const getTeam = (db, teamId) =>
  db.prepare('SELECT id, name, created_at AS createdAt FROM teams WHERE id = ?').get(teamId) ?? null;

export const listTeamsForUser = (db, userId) =>
  db
    .prepare(
      `SELECT t.id, t.name, m.role, t.created_at AS createdAt
         FROM memberships m
         JOIN teams t ON t.id = m.team_id
        WHERE m.user_id = ?
        ORDER BY t.name COLLATE NOCASE`,
    )
    .all(userId);

export const listMembers = (db, teamId) =>
  db
    .prepare(
      `SELECT u.id, u.name, u.email, m.role, m.created_at AS joinedAt
         FROM memberships m
         JOIN users u ON u.id = m.user_id
        WHERE m.team_id = ?
        ORDER BY m.created_at`,
    )
    .all(teamId);

export function renameTeam(db, teamId, name) {
  db.prepare('UPDATE teams SET name = ? WHERE id = ?').run(name, teamId);
  return getTeam(db, teamId);
}

export function addMember(db, { teamId, userId, role, now }) {
  try {
    db.prepare(
      'INSERT INTO memberships (team_id, user_id, role, created_at) VALUES (?, ?, ?, ?)',
    ).run(teamId, userId, role, toIso(now));
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflict('That person is already in this team');
    }
    throw error;
  }
  return getTeam(db, teamId);
}

const countOwners = (db, teamId) =>
  db.prepare("SELECT COUNT(*) AS owners FROM memberships WHERE team_id = ? AND role = 'owner'").get(teamId)
    .owners;

const roleOf = (db, teamId, userId) =>
  db.prepare('SELECT role FROM memberships WHERE team_id = ? AND user_id = ?').get(teamId, userId)
    ?.role;

export function changeRole(db, { teamId, userId, role }) {
  return transaction(db, () => {
    const current = roleOf(db, teamId, userId);
    if (!current) {
      throw notFound('That person is not in this team');
    }
    if (current === 'owner' && role !== 'owner' && countOwners(db, teamId) === 1) {
      throw conflict('A team needs at least one owner');
    }
    db.prepare('UPDATE memberships SET role = ? WHERE team_id = ? AND user_id = ?').run(
      role,
      teamId,
      userId,
    );
    return { userId, role };
  });
}

export function removeMember(db, { teamId, userId }) {
  transaction(db, () => {
    const current = roleOf(db, teamId, userId);
    if (!current) {
      throw notFound('That person is not in this team');
    }
    if (current === 'owner' && countOwners(db, teamId) === 1) {
      throw conflict('A team needs at least one owner');
    }
    db.prepare('DELETE FROM memberships WHERE team_id = ? AND user_id = ?').run(teamId, userId);
  });
}
