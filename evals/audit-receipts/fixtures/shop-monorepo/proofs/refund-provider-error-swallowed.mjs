// When the provider refuses a refund, the API still records it, marks the order refunded and answers 200.
// Run from the root of a copy of repo/.
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const load = (path) => import(pathToFileURL(join(root, path)).href);
const { createTestApp, checkout } = await load("apps/api/test/helpers.js");
const { ProviderError } = await load("packages/payments/src/index.js");

const t = createTestApp();
const product = t.addProduct({ priceCents: 3000 });
const shopper = await t.signUp();
const admin = await t.signUp({ email: "staff@example.com", admin: true });
const { order, payment } = await checkout(t, shopper.cookie, [{ productId: product.id }]);
await t.request({ method: "POST", path: `/api/dev/payments/${payment.intentId}/pay`, cookie: shopper.cookie });

let providerCalls = 0;
t.payments.refund = async () => {
  providerCalls += 1;
  throw new ProviderError("Card network unavailable", "processing_error");
};

const response = await t.request({
  method: "POST",
  path: `/api/admin/orders/${order.number}/refund`,
  cookie: admin.cookie,
  body: { amountCents: order.totalCents },
});
const refunds = response.body?.order?.refunds ?? [];

console.log("provider called", providerCalls, "times and refused");
console.log("API status", response.status, "order status", response.body?.order?.status, "refund rows", JSON.stringify(refunds));
process.exit(
  providerCalls === 1 && response.status === 200 && response.body.order.status === "refunded" && refunds.length === 1 && refunds[0].providerRefundId === null
    ? 0
    : 1,
);
