// ADR 0004: buyers reach holds and orders only through 128-bit random tokens, with no login. The
// code follows it: tokens come from randomBytes(16), lookups are exact matches on the token, and
// numeric hold and order ids are neither accepted nor returned.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { addOrganiser, buy, check, hold, load, makeApp, onSaleEvent, ROOT } from './lib.mjs';

const ids = readFileSync(join(ROOT, 'src/lib/ids.js'), 'utf8');
check(/randomBytes\(16\)\.toString\('hex'\)/.test(ids), 'newToken uses 16 bytes from crypto.randomBytes');
const { newToken } = await load('src/lib/ids.js');
const sample = new Set(Array.from({ length: 2000 }, () => newToken()));
check(sample.size === 2000 && [...sample].every((token) => /^[0-9a-f]{32}$/.test(token)), '2000 tokens: 32 hex chars, all distinct');

const { ctx, call } = await makeApp();
const { key } = await addOrganiser(ctx, 'harbour-hall');
const { eventId, tierIds } = await onSaleEvent(call, key);
const order = await buy(call, eventId, tierIds[0]);
const holdToken = await hold(call, eventId, tierIds[0]);
const orderRow = ctx.db.prepare('SELECT id, hold_id FROM orders WHERE token = ?').get(order.token);

check((await call('GET', `/orders/${orderRow.id}`)).status === 404, 'GET /orders/<numeric id> is 404');
check((await call('GET', `/holds/${orderRow.hold_id}`)).status === 404, 'GET /holds/<numeric id> is 404');
check((await call('GET', `/orders/${order.token.slice(0, 31)}`)).status === 404, 'a token prefix is 404');
check((await call('GET', `/orders/${order.token.toUpperCase()}`)).status === 404, 'lookup is exact');
check((await call('GET', '/orders/%25')).status === 404, 'wildcards are not patterns');

const body = (await call('GET', `/orders/${order.token}`)).body + (await call('GET', `/holds/${holdToken}`)).body;
check(!/"(id|holdId|orderId)"/.test(body), 'buyer responses carry no hold or order id');
