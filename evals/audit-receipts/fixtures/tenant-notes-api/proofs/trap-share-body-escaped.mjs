// renderSharedNote inserts ${body} without calling escapeHtml at that spot, but paragraphs() escapes the
// whole text first and only adds <p> and <br>. The title is escaped too.
import { check, load } from './support/harness.mjs';

const { renderSharedNote } = await load('src/shares/page.js');

const payloads = [
  '<script>alert(1)</script>',
  '"><img src=x onerror=alert(1)>',
  "'><svg onload=alert(1)>",
  '</article><script>x</script>',
  '&lt;script&gt; already escaped',
  '<p onclick=alert(1)>hi</p>\n\n<br onmouseover=x>',
];
let unsafe = 0;
for (const payload of payloads) {
  const page = renderSharedNote({
    title: payload,
    body: `${payload}\nline\n\n${payload}`,
    updated_at: '2026-03-02T09:00:00.000Z',
    team_name: 'Design',
  });
  const article = page.slice(page.indexOf('<article>') + 9, page.indexOf('</article>'));
  const tags = article.match(/<[^>]*>/g) ?? [];
  const onlyParagraphs = tags.every((tag) => ['<p>', '</p>', '<br>'].includes(tag));
  const heading = page.match(/<h1>(.*)<\/h1>/s)?.[1] ?? '';
  const title = page.match(/<title>(.*)<\/title>/s)?.[1] ?? '';
  if (!onlyParagraphs || /[<>"']/.test(heading) || /[<>"']/.test(title)) {
    unsafe += 1;
  }
}

console.log({ payloads: payloads.length, unsafe });
check(unsafe === 0, 'note titles and bodies never produce markup beyond <p> and <br> on the share page');
