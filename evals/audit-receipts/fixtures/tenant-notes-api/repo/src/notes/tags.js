import { MAX_TAGS_PER_NOTE, TAG_MAX } from '../constants.js';
import { badRequest } from '../http/errors.js';

export const normalizeTag = (raw) =>
  raw.trim().replace(/^#+/, '').toLowerCase().replace(/\s+/g, '-');

export function readTags(value) {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw badRequest('tags must be an array of strings');
  }
  const tags = new Set();
  for (const raw of value) {
    if (typeof raw !== 'string') {
      throw badRequest('tags must be an array of strings');
    }
    const tag = normalizeTag(raw);
    if (tag.length > TAG_MAX) {
      throw badRequest(`each tag must be at most ${TAG_MAX} characters`);
    }
    if (tag) {
      tags.add(tag);
    }
  }
  if (tags.size > MAX_TAGS_PER_NOTE) {
    throw badRequest(`a note can have at most ${MAX_TAGS_PER_NOTE} tags`);
  }
  return [...tags];
}

export function replaceTags(db, noteId, tags) {
  db.prepare('DELETE FROM note_tags WHERE note_id = ?').run(noteId);
  const insert = db.prepare('INSERT INTO note_tags (note_id, tag) VALUES (?, ?)');
  for (const tag of tags) {
    insert.run(noteId, tag);
  }
}

export function tagsByNote(db, noteIds) {
  const byNote = new Map(noteIds.map((id) => [id, []]));
  if (noteIds.length === 0) {
    return byNote;
  }
  const placeholders = noteIds.map(() => '?').join(', ');
  const rows = db
    .prepare(`SELECT note_id, tag FROM note_tags WHERE note_id IN (${placeholders}) ORDER BY tag`)
    .all(...noteIds);
  for (const row of rows) {
    byNote.get(row.note_id)?.push(row.tag);
  }
  return byNote;
}
