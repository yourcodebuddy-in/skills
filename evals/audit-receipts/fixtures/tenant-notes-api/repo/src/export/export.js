import { badRequest } from '../http/errors.js';
import { toCsv } from './csv.js';

const EXPORT_COLUMNS = new Map([
  ['id', 'n.id'],
  ['title', 'n.title'],
  ['body', 'n.body'],
  ['tags', "(SELECT group_concat(tag, ' ') FROM note_tags WHERE note_id = n.id)"],
  ['author', 'u.email'],
  ['created_at', 'n.created_at'],
  ['updated_at', 'n.updated_at'],
]);

const DEFAULT_COLUMNS = ['id', 'title', 'tags', 'author', 'updated_at'];

export function readExportColumns(param) {
  if (!param) {
    return DEFAULT_COLUMNS;
  }
  const names = [...new Set(param.split(',').map((name) => name.trim()).filter(Boolean))];
  if (names.length === 0) {
    return DEFAULT_COLUMNS;
  }
  const unknown = names.filter((name) => !EXPORT_COLUMNS.has(name));
  if (unknown.length > 0) {
    throw badRequest(
      `Unknown column: ${unknown.join(', ')}. Choose from ${[...EXPORT_COLUMNS.keys()].join(', ')}`,
    );
  }
  return names;
}

export function exportNotes(db, teamId, columns) {
  const select = columns.map((name) => `${EXPORT_COLUMNS.get(name)} AS ${name}`).join(', ');
  const rows = db
    .prepare(
      `SELECT ${select}
         FROM notes n
         JOIN users u ON u.id = n.author_id
        WHERE n.team_id = ?
        ORDER BY n.id`,
    )
    .all(teamId);
  return toCsv(
    columns,
    rows.map((row) => columns.map((name) => row[name])),
  );
}
