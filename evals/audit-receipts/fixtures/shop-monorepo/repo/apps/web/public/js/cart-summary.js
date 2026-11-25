import { formatPrice } from "./format.js";

export const FREE_SHIPPING_FROM_CENTS = 5000;
export const STANDARD_SHIPPING_CENTS = 599;

// Shown in the cart before the shopper picks an address; checkout gives the final figures.
export const shippingEstimate = (subtotalCents) =>
  subtotalCents === 0 || subtotalCents >= FREE_SHIPPING_FROM_CENTS ? 0 : STANDARD_SHIPPING_CENTS;

export const renderSummary = (cart) => {
  const shipping = shippingEstimate(cart.subtotalCents);
  const remaining = FREE_SHIPPING_FROM_CENTS - cart.subtotalCents;
  const nudge =
    shipping > 0 ? `<p class="nudge">Add ${formatPrice(remaining)} more for free US shipping.</p>` : "";
  return `
    <dl class="summary">
      <div><dt>Subtotal</dt><dd>${formatPrice(cart.subtotalCents)}</dd></div>
      <div><dt>Shipping (US)</dt><dd>${shipping === 0 ? "Free" : formatPrice(shipping)}</dd></div>
      <div class="summary-total"><dt>Estimated total</dt><dd>${formatPrice(cart.subtotalCents + shipping)}</dd></div>
    </dl>
    ${nudge}
    <p class="muted">Tax is worked out at checkout.</p>`;
};
