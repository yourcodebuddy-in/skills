// Delivering the same payment.succeeded event twice records two payments, queues two confirmation
// emails and doubles the takings report. Run from the root of a copy of repo/.
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const load = (path) => import(pathToFileURL(join(root, path)).href);
const { createTestApp, checkout } = await load("apps/api/test/helpers.js");

const t = createTestApp();
const product = t.addProduct({ priceCents: 2000, stock: 5 });
const shopper = await t.signUp();
const admin = await t.signUp({ email: "staff@example.com", admin: true });
const { order, payment } = await checkout(t, shopper.cookie, [{ productId: product.id }]);

await t.request({ method: "POST", path: `/api/dev/payments/${payment.intentId}/pay`, cookie: shopper.cookie });
const [delivery] = t.deliveries;

// The provider sends the same event again, as it does when it didn't see the first 2xx.
const again = await t.request({
  method: "POST",
  path: "/api/webhooks/payments",
  body: delivery.body,
  headers: { "fakepay-signature": delivery.signature },
});

const stored = t.store.orders.findByNumber(order.number);
const payments = t.store.db.prepare("SELECT COUNT(*) AS n FROM payments WHERE order_id = ?").get(stored.id).n;
const emails = t.store.db.prepare("SELECT COUNT(*) AS n FROM outbox WHERE kind = 'order_confirmation'").get().n;
const today = new Date().toISOString().slice(0, 10);
const report = await t.request({ path: `/api/admin/reports/sales?from=${today}&to=${today}`, cookie: admin.cookie });

console.log("second delivery status", again.status);
console.log("payment rows", payments, "confirmation emails", emails);
console.log("order total", order.totalCents, "reported paid", report.body.paidCents);

process.exit(again.status === 200 && payments === 2 && emails === 2 && report.body.paidCents === 2 * order.totalCents ? 0 : 1);
