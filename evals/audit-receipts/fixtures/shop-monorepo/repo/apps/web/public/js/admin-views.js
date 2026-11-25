import { escapeHtml } from "./escape.js";
import { formatDate, formatPrice, statusLabel } from "./format.js";

const statusBadge = (status) =>
  `<span class="status status-${escapeHtml(status)}">${escapeHtml(statusLabel(status))}</span>`;

export const renderOrderRow = (order) => `
  <tr>
    <td><button type="button" class="link-button" data-open-order="${escapeHtml(order.number)}">${escapeHtml(order.number)}</button></td>
    <td>${formatDate(order.createdAt)}</td>
    <td>${escapeHtml(order.customerEmail)}</td>
    <td class="numeric">${order.itemCount}</td>
    <td class="numeric">${formatPrice(order.totalCents)}</td>
    <td>${statusBadge(order.status)}</td>
  </tr>`;

const address = (shipping) =>
  [shipping.name, shipping.line1, shipping.line2, `${shipping.city} ${shipping.postcode}`, shipping.country]
    .filter(Boolean)
    .map(escapeHtml)
    .join("<br>");

const itemRows = (items) =>
  items
    .map(
      (item) => `
      <tr>
        <td>${escapeHtml(item.sku)}</td>
        <td>${escapeHtml(item.name)}</td>
        <td class="numeric">${item.quantity}</td>
        <td class="numeric">${formatPrice(item.unitPriceCents)}</td>
        <td class="numeric">${formatPrice(item.lineTotalCents)}</td>
      </tr>`,
    )
    .join("");

const refundRows = (refunds) =>
  refunds.length === 0
    ? ""
    : `<h3>Refunds</h3>
       <ul class="plain">
         ${refunds.map((refund) => `<li>${formatPrice(refund.amountCents)} on ${formatDate(refund.createdAt)}</li>`).join("")}
       </ul>`;

const actions = (order) => {
  const buttons = [];
  if (order.status === "paid") {
    buttons.push(`<button type="button" class="button" data-fulfil="${escapeHtml(order.number)}">Mark as shipped</button>`);
  }
  if (order.refundableCents > 0) {
    buttons.push(`
      <form class="inline-form" data-refund="${escapeHtml(order.number)}">
        <label for="refund-amount">Refund amount ($)</label>
        <input id="refund-amount" name="amount" inputmode="decimal" value="${(order.refundableCents / 100).toFixed(2)}" required>
        <button type="submit" class="button button-danger">Refund</button>
      </form>`);
  }
  return buttons.join("");
};

export const renderOrderDetail = (order) => `
  <header class="detail-header">
    <h2 tabindex="-1">Order ${escapeHtml(order.number)}</h2>
    ${statusBadge(order.status)}
  </header>
  <div class="detail-grid">
    <section>
      <h3>Customer</h3>
      <p>${escapeHtml(order.customer?.name)}<br>${escapeHtml(order.customer?.email)}</p>
      <h3>Ship to</h3>
      <address>${address(order.shipping)}</address>
      ${order.note ? `<h3>Delivery note</h3><p class="note">${order.note}</p>` : ""}
    </section>
    <section>
      <table class="table">
        <thead><tr><th>SKU</th><th>Item</th><th class="numeric">Qty</th><th class="numeric">Price</th><th class="numeric">Total</th></tr></thead>
        <tbody>${itemRows(order.items)}</tbody>
      </table>
      <dl class="summary">
        <div><dt>Subtotal</dt><dd>${formatPrice(order.subtotalCents)}</dd></div>
        <div><dt>Discount${order.couponCode ? ` (${escapeHtml(order.couponCode)})` : ""}</dt><dd>${formatPrice(order.discountCents)}</dd></div>
        <div><dt>Shipping</dt><dd>${formatPrice(order.shippingCents)}</dd></div>
        <div><dt>Tax</dt><dd>${formatPrice(order.taxCents)}</dd></div>
        <div class="summary-total"><dt>Total</dt><dd>${formatPrice(order.totalCents)}</dd></div>
      </dl>
      ${refundRows(order.refunds)}
    </section>
  </div>
  <div class="detail-actions">${actions(order)}</div>`;

export const renderProductRow = (product) => `
  <tr>
    <td>${escapeHtml(product.sku)}</td>
    <td>${escapeHtml(product.name)}</td>
    <td class="numeric">${formatPrice(product.priceCents)}</td>
    <td class="numeric">${product.stock}</td>
    <td>${product.active ? "Listed" : "Hidden"}</td>
    <td><button type="button" class="link-button" data-edit-product="${Number(product.id)}">Edit</button></td>
  </tr>`;

export const renderCouponRow = (coupon) => {
  const value = coupon.percentOff === null ? formatPrice(coupon.amountOffCents) : `${coupon.percentOff}%`;
  const uses = coupon.maxRedemptions === null ? `${coupon.redemptions}` : `${coupon.redemptions} / ${coupon.maxRedemptions}`;
  return `
  <tr>
    <td>${escapeHtml(coupon.code)}</td>
    <td>${value} off</td>
    <td class="numeric">${coupon.minSubtotalCents > 0 ? formatPrice(coupon.minSubtotalCents) : "—"}</td>
    <td class="numeric">${uses}</td>
    <td>${coupon.expiresOn ? escapeHtml(coupon.expiresOn) : "Never"}</td>
  </tr>`;
};

export const renderSalesReport = (report) => `
  <p class="report-total">Net takings ${formatPrice(report.netCents)}
    <span class="muted">(${formatPrice(report.paidCents)} paid, ${formatPrice(report.refundedCents)} refunded)</span></p>
  <table class="table">
    <thead><tr><th>Day</th><th class="numeric">Paid</th><th class="numeric">Refunded</th><th class="numeric">Net</th></tr></thead>
    <tbody>
      ${report.days
        .map(
          (row) => `
        <tr>
          <td>${escapeHtml(row.day)}</td>
          <td class="numeric">${formatPrice(row.paidCents)}</td>
          <td class="numeric">${formatPrice(row.refundedCents)}</td>
          <td class="numeric">${formatPrice(row.netCents)}</td>
        </tr>`,
        )
        .join("")}
    </tbody>
  </table>`;
