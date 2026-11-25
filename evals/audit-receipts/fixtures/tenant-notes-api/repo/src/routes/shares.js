import { requireRole, requireUser } from '../auth/guard.js';
import { notFound } from '../http/errors.js';
import { html, json, noContent } from '../http/respond.js';
import { readId } from '../lib/validate.js';
import { getNote } from '../notes/notes.js';
import { notFoundPage, renderSharedNote } from '../shares/page.js';
import {
  createShareLink,
  findSharedNote,
  listShareLinks,
  readExpiryDays,
  revokeShareLink,
} from '../shares/shares.js';

export function registerShareRoutes(router, { db, config }) {
  const noteForEditor = (ctx) => {
    const user = requireUser(ctx);
    const { teamId } = ctx.params;
    requireRole(db, teamId, user.id, 'editor');
    const note = getNote(db, teamId, readId(ctx.params.noteId));
    if (!note) {
      throw notFound('Note not found');
    }
    return { user, note };
  };

  router.add('POST', '/teams/:teamId/notes/:noteId/shares', async (ctx) => {
    const { user, note } = noteForEditor(ctx);
    const body = await ctx.body();
    const link = createShareLink(db, {
      noteId: note.id,
      userId: user.id,
      days: readExpiryDays(body.expiresInDays),
      now: ctx.now,
    });
    return json(201, {
      id: link.id,
      url: `${config.publicUrl}/s/${link.token}`,
      expiresAt: link.expiresAt,
    });
  });

  router.add('GET', '/teams/:teamId/notes/:noteId/shares', (ctx) => {
    const { note } = noteForEditor(ctx);
    return json(200, { shares: listShareLinks(db, note.id) });
  });

  router.add('DELETE', '/teams/:teamId/notes/:noteId/shares/:shareId', (ctx) => {
    const { note } = noteForEditor(ctx);
    const shareId = readId(ctx.params.shareId);
    if (!revokeShareLink(db, { noteId: note.id, shareId, now: ctx.now })) {
      throw notFound('Share link not found');
    }
    return noContent();
  });

  router.add('GET', '/s/:token', (ctx) => {
    const shared = findSharedNote(db, ctx.params.token, ctx.now);
    if (!shared) {
      return html(404, notFoundPage());
    }
    return html(200, renderSharedNote(shared));
  });
}
