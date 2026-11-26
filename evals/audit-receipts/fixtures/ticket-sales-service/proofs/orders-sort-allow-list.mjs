// listOrders builds ORDER BY with a template literal. Every value that reaches it comes from a Map
// of fixed column names (or the default) and a two-way choice of ASC/DESC, so no request input
// reaches the SQL text.
import { addOrganiser, buy, check, load, makeApp, onSaleEvent } from './lib.mjs';

const { ctx, call } = await makeApp();
const { key } = await addOrganiser(ctx, 'harbour-hall');
const { eventId, tierIds } = await onSaleEvent(call, key);
await buy(call, eventId, tierIds[0], { quantity: 1, name: 'Bea' });
await buy(call, eventId, tierIds[0], { quantity: 2, name: 'Abe' });

const statements = [];
const prepare = ctx.db.prepare.bind(ctx.db);
ctx.db.prepare = (sql) => {
  statements.push(sql);
  return prepare(sql);
};

const ALLOWED = new Set(['o.created_at', 'o.paid_at', 'o.total_cents', 'o.buyer_name', 'o.quantity']);
const hostile = [
  'total; DROP TABLE orders; --',
  "buyer_name) UNION SELECT secret_hash FROM api_keys --",
  '__proto__',
  'constructor',
  'toString',
  'o.total_cents',
  '',
  '1',
  "created' OR '1'='1",
  'total\nDESC',
];
const dirs = ['asc', 'desc', 'ASC', "asc; DELETE FROM orders", '', 'x'];

for (const sort of hostile) {
  for (const dir of dirs) {
    statements.length = 0;
    const query = new URLSearchParams({ sort, dir });
    const res = await call('GET', `/events/${eventId}/orders?${query}`, { key });
    if (res.status !== 200 || res.json.orders.length !== 2) check(false, `sort=${JSON.stringify(sort)} dir=${JSON.stringify(dir)} answered ${res.status}`);
    const sql = statements.find((text) => text.includes('ORDER BY'));
    const [, column, direction] = /ORDER BY (\S+) (ASC|DESC), o\.id (ASC|DESC)/.exec(sql) ?? [];
    if (!ALLOWED.has(column) || !['ASC', 'DESC'].includes(direction)) check(false, `unexpected ORDER BY in ${sql}`);
  }
}
check(true, `${hostile.length * dirs.length} hostile sort/dir pairs all produced an allowed column and direction`);

const tables = ctx.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name);
check(tables.includes('orders') && ctx.db.prepare('SELECT COUNT(*) AS n FROM orders').get().n === 2, 'orders table intact');

const { listOrders } = await load('src/services/reports.js');
const odd = listOrders(ctx.db, 1, eventId, new URLSearchParams([['sort', 'total'], ['sort', 'x;--'], ['dir', 'asc']]));
check(odd.orders.length === 2, 'repeated query keys are handled (URLSearchParams.get takes the first)');
