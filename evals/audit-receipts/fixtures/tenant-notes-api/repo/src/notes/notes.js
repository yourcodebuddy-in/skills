import { NOTE_BODY_MAX, NOTE_TITLE_MAX } from '../constants.js';
import { transaction } from '../db/transaction.js';
import { badRequest } from '../http/errors.js';
import { toPage } from '../lib/pagination.js';
import { toIso } from '../lib/time.js';
import { readString } from '../lib/validate.js';
import { readTags, replaceTags, tagsByNote } from './tags.js';

const LIKE_SPECIALS = /[\\%_]/g;

export function readNoteInput(body, { partial = false } = {}) {
  const input = {};
  if (body.title !== undefined || !partial) {
    input.title = readString(body.title, 'title', { max: NOTE_TITLE_MAX });
  }
  if (body.body !== undefined || !partial) {
    if (typeof body.body !== 'string') {
      throw badRequest('body must be a string');
    }
    if (body.body.length > NOTE_BODY_MAX) {
      throw badRequest(`body must be at most ${NOTE_BODY_MAX} characters`);
    }
    input.body = body.body;
  }
  const tags = readTags(body.tags);
  if (tags !== undefined) {
    input.tags = tags;
  }
  if (partial && Object.keys(input).length === 0) {
    throw badRequest('Nothing to change: send a title, body or tags');
  }
  return input;
}

const toNote = (row, tags) => ({
  id: row.id,
  teamId: row.team_id,
  authorId: row.author_id,
  title: row.title,
  body: row.body,
  tags,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export function getNote(db, teamId, noteId) {
  const row = db.prepare('SELECT * FROM notes WHERE id = ? AND team_id = ?').get(noteId, teamId);
  if (!row) {
    return null;
  }
  return toNote(row, tagsByNote(db, [row.id]).get(row.id));
}

export function createNote(db, { teamId, authorId, input, now }) {
  const id = transaction(db, () => {
    const result = db
      .prepare(
        `INSERT INTO notes (team_id, author_id, title, body, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(teamId, authorId, input.title, input.body, toIso(now), toIso(now));
    const noteId = Number(result.lastInsertRowid);
    replaceTags(db, noteId, input.tags ?? []);
    return noteId;
  });
  return getNote(db, teamId, id);
}

export function updateNote(db, noteId, input, now) {
  return transaction(db, () => {
    const current = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId);
    if (!current) {
      return null;
    }
    db.prepare('UPDATE notes SET title = ?, body = ?, updated_at = ? WHERE id = ?').run(
      input.title ?? current.title,
      input.body ?? current.body,
      toIso(now),
      noteId,
    );
    if (input.tags) {
      replaceTags(db, noteId, input.tags);
    }
    return getNote(db, current.team_id, noteId);
  });
}

export function deleteNote(db, teamId, noteId) {
  const result = db.prepare('DELETE FROM notes WHERE id = ? AND team_id = ?').run(noteId, teamId);
  return result.changes > 0;
}

export function listNotes(db, teamId, { tag, query, before, limit }) {
  const where = ['n.team_id = ?'];
  const args = [teamId];
  if (before) {
    where.push('n.id < ?');
    args.push(before);
  }
  if (tag) {
    where.push('EXISTS (SELECT 1 FROM note_tags t WHERE t.note_id = n.id AND t.tag = ?)');
    args.push(tag);
  }
  if (query) {
    const pattern = `%${query.replace(LIKE_SPECIALS, (char) => `\\${char}`)}%`;
    where.push("(n.title LIKE ? ESCAPE '\\' OR n.body LIKE ? ESCAPE '\\')");
    args.push(pattern, pattern);
  }

  const rows = db
    .prepare(
      `SELECT n.id, n.team_id, n.author_id, n.title, n.body, n.created_at, n.updated_at
         FROM notes n
        WHERE ${where.join(' AND ')}
        ORDER BY n.id DESC
        LIMIT ?`,
    )
    .all(...args, limit + 1);

  const page = toPage(rows, limit);
  const tags = tagsByNote(
    db,
    page.items.map((row) => row.id),
  );
  return {
    notes: page.items.map((row) => toNote(row, tags.get(row.id))),
    nextCursor: page.nextCursor,
  };
}
