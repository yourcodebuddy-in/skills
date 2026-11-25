import assert from "node:assert/strict";
import test from "node:test";
import { renderOrderDetail, renderOrderRow } from "../public/js/admin-views.js";
import { shippingEstimate } from "../public/js/cart-summary.js";
import { escapeHtml } from "../public/js/escape.js";
import { formatPrice, statusLabel } from "../public/js/format.js";
import { renderCartLine, renderProductCard } from "../public/js/views.js";

const SCRIPT = "<script>alert(1)</script>";

const order = {
  number: "SO-ABCD2345",
  status: "paid",
  createdAt: "2026-11-02T10:00:00Z",
  customer: { id: 1, name: "Sam Shopper", email: "sam@example.com" },
  shipping: { name: SCRIPT, line1: "1 Main St", line2: null, city: "Springfield", postcode: "12345", country: "US" },
  note: null,
  couponCode: null,
  items: [{ productId: 1, sku: "MUG-STONE", name: SCRIPT, quantity: 1, unitPriceCents: 1800, lineTotalCents: 1800 }],
  subtotalCents: 1800,
  discountCents: 0,
  shippingCents: 599,
  taxCents: 149,
  totalCents: 2548,
  refunds: [],
  refundableCents: 2548,
};

test("escapes the five HTML special characters", () => {
  assert.equal(escapeHtml(`<a href="x">'&'</a>`), "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  assert.equal(escapeHtml(null), "");
});

test("formats prices and statuses", () => {
  assert.equal(formatPrice(1005), "$10.05");
  assert.equal(statusLabel("fulfilled"), "Shipped");
  assert.equal(statusLabel("on_hold"), "on_hold");
});

test("escapes product text on the storefront", () => {
  const html = renderProductCard({ id: 1, name: SCRIPT, description: SCRIPT, priceCents: 100, inStock: true });
  assert.ok(!html.includes("<script>"));
  assert.match(html, /Add to cart/);
});

test("escapes cart lines", () => {
  const html = renderCartLine({ productId: 2, name: SCRIPT, quantity: 2, unitPriceCents: 100, lineTotalCents: 200, available: true });
  assert.ok(!html.includes("<script>"));
  assert.match(html, /<option value="2" selected>/);
});

test("escapes customer-entered text in the admin order views", () => {
  const row = renderOrderRow({ ...order, customerEmail: `${SCRIPT}@example.com`, itemCount: 1 });
  assert.ok(!row.includes("<script>"));
  const detail = renderOrderDetail(order);
  assert.ok(!detail.includes("<script>"));
  assert.match(detail, /Mark as shipped/);
});

test("estimates free US shipping from $50", () => {
  assert.equal(shippingEstimate(0), 0);
  assert.equal(shippingEstimate(4999), 599);
  assert.equal(shippingEstimate(5000), 0);
});
