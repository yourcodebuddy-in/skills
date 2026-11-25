import { escapeHtml } from '../lib/html.js';
import { formatDay } from '../lib/time.js';

const BLANK_LINES = /\n\s*\n/;

const paragraphs = (text) =>
  escapeHtml(text)
    .split(BLANK_LINES)
    .filter((block) => block.trim() !== '')
    .map((block) => `<p>${block.trim().replaceAll('\n', '<br>')}</p>`)
    .join('\n');

const STYLE = `
  body { margin: 0; font: 16px/1.6 system-ui, sans-serif; color: #1d1d1f; background: #fafafa; }
  main { max-width: 42rem; margin: 0 auto; padding: 3rem 1rem; }
  h1 { font-size: 1.75rem; line-height: 1.25; margin: 0 0 0.25rem; }
  .meta { color: #6e6e73; margin: 0 0 2rem; font-size: 0.875rem; }
  footer { max-width: 42rem; margin: 0 auto; padding: 0 1rem 3rem; color: #6e6e73; font-size: 0.875rem; }
  @media (prefers-color-scheme: dark) {
    body { color: #f5f5f7; background: #111; }
    .meta, footer { color: #a1a1a6; }
  }
`;

export function renderSharedNote(note) {
  const title = escapeHtml(note.title);
  const body = paragraphs(note.body);
  const team = note.team_name;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${title}</title>
<style>${STYLE}</style>
</head>
<body>
<main>
<h1>${title}</h1>
<p class="meta">Updated ${formatDay(note.updated_at)}</p>
<article>
${body}
</article>
</main>
<footer>Shared from ${team} with Tenant Notes</footer>
</body>
</html>
`;
}

export const notFoundPage = () => `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Link not available</title></head>
<body><main><h1>This link isn't available</h1><p>It may have expired or been turned off by the person who shared it.</p></main></body>
</html>
`;
