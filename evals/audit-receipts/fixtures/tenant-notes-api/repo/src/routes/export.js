import { requireRole, requireUser } from '../auth/guard.js';
import { exportNotes, readExportColumns } from '../export/export.js';
import { csv } from '../http/respond.js';
import { utcDay } from '../lib/time.js';

export function registerExportRoutes(router, { db }) {
  router.add('GET', '/teams/:teamId/export.csv', (ctx) => {
    const user = requireUser(ctx);
    const { teamId } = ctx.params;
    requireRole(db, teamId, user.id, 'viewer');
    const columns = readExportColumns(ctx.url.searchParams.get('columns'));
    return csv(exportNotes(db, teamId, columns), `notes-${utcDay(ctx.now)}.csv`);
  });
}
