import { requireRole, requireUser } from '../auth/guard.js';
import { notFound } from '../http/errors.js';
import { json, noContent } from '../http/respond.js';
import { readPage } from '../lib/pagination.js';
import { readId } from '../lib/validate.js';
import { createNote, deleteNote, getNote, listNotes, readNoteInput, updateNote } from '../notes/notes.js';

export function registerNoteRoutes(router, { db }) {
  router.add('GET', '/teams/:teamId/notes', (ctx) => {
    const user = requireUser(ctx);
    const { teamId } = ctx.params;
    requireRole(db, teamId, user.id, 'viewer');

    const search = ctx.url.searchParams;
    const tag = search.get('tag')?.trim().toLowerCase() || null;
    const query = search.get('q')?.trim() || null;
    const { limit, before } = readPage(search);

    return json(200, listNotes(db, teamId, { tag, query, before, limit }));
  });

  router.add('POST', '/teams/:teamId/notes', async (ctx) => {
    const user = requireUser(ctx);
    const { teamId } = ctx.params;
    requireRole(db, teamId, user.id, 'editor');
    const input = readNoteInput(await ctx.body());
    const note = createNote(db, { teamId, authorId: user.id, input, now: ctx.now });
    return json(201, note);
  });

  router.add('GET', '/teams/:teamId/notes/:noteId', (ctx) => {
    const user = requireUser(ctx);
    const { teamId } = ctx.params;
    requireRole(db, teamId, user.id, 'viewer');
    const note = getNote(db, teamId, readId(ctx.params.noteId));
    if (!note) {
      throw notFound('Note not found');
    }
    return json(200, note);
  });

  router.add('PATCH', '/teams/:teamId/notes/:noteId', async (ctx) => {
    const user = requireUser(ctx);
    const { teamId } = ctx.params;
    requireRole(db, teamId, user.id, 'editor');
    const input = readNoteInput(await ctx.body(), { partial: true });
    const note = updateNote(db, readId(ctx.params.noteId), input, ctx.now);
    if (!note) {
      throw notFound('Note not found');
    }
    return json(200, note);
  });

  router.add('DELETE', '/teams/:teamId/notes/:noteId', (ctx) => {
    const user = requireUser(ctx);
    const { teamId } = ctx.params;
    requireRole(db, teamId, user.id, 'editor');
    if (!deleteNote(db, teamId, readId(ctx.params.noteId))) {
      throw notFound('Note not found');
    }
    return noContent();
  });
}
