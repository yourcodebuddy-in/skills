import { invalid, notFound } from '../http/errors.js';
import { toCsv } from '../lib/csv.js';
import { formatMoney } from '../lib/money.js';
import { localDateTime, localDay } from '../lib/time.js';
import { getEvent, getEventForTenant } from './events.js';

const SORT_COLUMNS = new Map([
  ['created', 'o.created_at'],
  ['paid', 'o.paid_at'],
  ['total', 'o.total_cents'],
  ['buyer', 'o.buyer_name'],
  ['quantity', 'o.quantity'],
]);
const ORDER_STATUSES = new Set(['pending', 'charging', 'paid', 'failed', 'refunded']);
const PAGE_SIZE = 50;

// Orders for one of the organiser's events, newest first unless asked otherwise.
export function listOrders(db, tenantId, eventId, query) {
  getEventForTenant(db, tenantId, eventId);
  const column = SORT_COLUMNS.get(query.get('sort')) ?? 'o.created_at';
  const direction = query.get('dir') === 'asc' ? 'ASC' : 'DESC';
  const status = query.get('status');
  if (status !== null && !ORDER_STATUSES.has(status)) throw invalid('status', 'unknown order status');
  const page = Math.max(1, Number.parseInt(query.get('page') ?? '1', 10) || 1);

  const rows = db
    .prepare(
      `SELECT o.token, o.buyer_name, o.buyer_email, o.quantity, o.refunded_quantity, o.total_cents,
              o.currency, o.status, o.created_at, o.paid_at, t.name AS tier_name
       FROM orders o JOIN tiers t ON t.id = o.tier_id
       WHERE o.event_id = ? AND (? IS NULL OR o.status = ?)
       ORDER BY ${column} ${direction}, o.id ${direction}
       LIMIT ? OFFSET ?`,
    )
    .all(eventId, status, status, PAGE_SIZE, (page - 1) * PAGE_SIZE);

  return {
    page,
    orders: rows.map((row) => ({
      token: row.token,
      buyerName: row.buyer_name,
      buyerEmail: row.buyer_email,
      tier: row.tier_name,
      quantity: row.quantity,
      refundedQuantity: row.refunded_quantity,
      totalCents: row.total_cents,
      currency: row.currency,
      status: row.status,
      createdAt: row.created_at,
      paidAt: row.paid_at,
    })),
  };
}

// Sales for one event: tickets sold per tier, money taken and refunded, and orders per local day.
export function salesSummary(db, tenant, eventId) {
  const event = getEventForTenant(db, tenant.id, eventId);
  const tiers = db
    .prepare(
      `SELECT t.id, t.name, t.capacity, t.price_cents,
              COALESCE(SUM(CASE WHEN o.status IN ('paid', 'refunded') THEN o.quantity - o.refunded_quantity END), 0) AS sold
       FROM tiers t LEFT JOIN orders o ON o.tier_id = t.id
       WHERE t.event_id = ?
       GROUP BY t.id ORDER BY t.position, t.id`,
    )
    .all(eventId);
  const money = db
    .prepare(
      `SELECT COALESCE(SUM(total_cents), 0) AS gross, COUNT(*) AS orders, MAX(currency) AS currency
       FROM orders WHERE event_id = ? AND status IN ('paid', 'refunded')`,
    )
    .get(eventId);
  const refunded = db
    .prepare(
      `SELECT COALESCE(SUM(r.amount_cents), 0) AS cents
       FROM refunds r JOIN orders o ON o.id = r.order_id WHERE o.event_id = ?`,
    )
    .get(eventId).cents;
  const paidAt = db
    .prepare("SELECT paid_at, quantity FROM orders WHERE event_id = ? AND status IN ('paid', 'refunded')")
    .all(eventId);

  const days = new Map();
  for (const row of paidAt) {
    const day = localDay(row.paid_at, tenant.timezone);
    const entry = days.get(day) ?? { day, orders: 0, tickets: 0 };
    entry.orders += 1;
    entry.tickets += row.quantity;
    days.set(day, entry);
  }

  const currency = money.currency ?? 'EUR';
  const net = money.gross - refunded;
  return {
    event: { id: event.id, title: event.title, status: event.status },
    tiers: tiers.map((tier) => ({ id: tier.id, name: tier.name, capacity: tier.capacity, sold: tier.sold })),
    orders: money.orders,
    grossCents: money.gross,
    refundedCents: refunded,
    netCents: net,
    display: {
      gross: formatMoney(money.gross, currency),
      refunded: formatMoney(-refunded, currency),
      net: formatMoney(net, currency),
    },
    byDay: [...days.values()].sort((a, b) => a.day.localeCompare(b.day)),
  };
}

const EXPORT_COLUMNS = (timeZone) => [
  { header: 'Order', value: (row) => row.token },
  { header: 'Paid at', value: (row) => localDateTime(row.paid_at, timeZone) },
  { header: 'Name', value: (row) => row.buyer_name },
  { header: 'Email', value: (row) => row.buyer_email },
  { header: 'Tier', value: (row) => row.tier_name },
  { header: 'Tickets', value: (row) => row.quantity - row.refunded_quantity },
  { header: 'Refunded tickets', value: (row) => row.refunded_quantity },
  { header: 'Total', value: (row) => (row.total_cents / 100).toFixed(2) },
  { header: 'Status', value: (row) => row.status },
];

// The organiser's door list and accounts export, one row per paid or refunded order.
export function exportOrdersCsv(db, eventId, { timeZone }) {
  const event = getEvent(db, eventId);
  if (!event) throw notFound('event_not_found');
  const rows = db
    .prepare(
      `SELECT o.*, t.name AS tier_name FROM orders o JOIN tiers t ON t.id = o.tier_id
       WHERE o.event_id = ? AND o.status IN ('paid', 'refunded')
       ORDER BY o.paid_at, o.id`,
    )
    .all(eventId);
  const filename = `${event.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'event'}-orders.csv`;
  return { filename, body: toCsv(EXPORT_COLUMNS(timeZone), rows) };
}
