import { ApiError, get, goToSignIn, post } from "./api.js";
import { escapeHtml } from "./escape.js";
import { formatPrice } from "./format.js";
import { loadNav, setCartCount } from "./nav.js";

const form = document.querySelector("[data-checkout-form]");
const totals = document.querySelector("[data-totals]");
const couponStatus = document.querySelector("[data-coupon-status]");
const formStatus = document.querySelector("[data-form-status]");
const paymentStep = document.querySelector("[data-payment]");
const doneStep = document.querySelector("[data-done]");

let appliedCoupon = null;

const renderTotals = (quote) => {
  const rows = [
    ["Subtotal", formatPrice(quote.subtotalCents)],
    ...(quote.discountCents > 0 ? [[`Discount (${escapeHtml(quote.couponCode)})`, `−${formatPrice(quote.discountCents)}`]] : []),
    ["Shipping", quote.shippingCents === 0 ? "Free" : formatPrice(quote.shippingCents)],
    ["Tax", formatPrice(quote.taxCents)],
  ];
  totals.innerHTML = `
    <dl class="summary">
      ${rows.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join("")}
      <div class="summary-total"><dt>Total</dt><dd>${formatPrice(quote.totalCents)}</dd></div>
    </dl>`;
};

const refreshQuote = async () => {
  try {
    const { quote } = await post("/api/checkout/quote", {
      couponCode: appliedCoupon ?? undefined,
      country: form.elements.country.value,
    });
    renderTotals(quote);
    return quote;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      goToSignIn();
      return null;
    }
    if (error instanceof ApiError && error.code === "cart_empty") {
      location.assign("/cart");
      return null;
    }
    throw error;
  }
};

const applyCoupon = async () => {
  const code = form.elements.coupon.value.trim();
  appliedCoupon = code || null;
  try {
    await refreshQuote();
    couponStatus.textContent = appliedCoupon ? `${appliedCoupon} applied.` : "";
  } catch (error) {
    appliedCoupon = null;
    couponStatus.textContent = error.message;
    await refreshQuote();
  }
};

const shippingFromForm = () => ({
  name: form.elements.name.value,
  line1: form.elements.line1.value,
  line2: form.elements.line2.value,
  city: form.elements.city.value,
  postcode: form.elements.postcode.value,
  country: form.elements.country.value,
});

const showPayment = ({ order, payment }) => {
  form.hidden = true;
  paymentStep.hidden = false;
  paymentStep.querySelector("[data-pay-amount]").textContent = formatPrice(order.totalCents);
  paymentStep.querySelector("[data-order-number]").textContent = order.number;
  const pay = paymentStep.querySelector("[data-pay]");
  pay.focus();
  pay.addEventListener("click", async () => {
    pay.disabled = true;
    try {
      const result = await post(`/api/dev/payments/${encodeURIComponent(payment.intentId)}/pay`);
      paymentStep.hidden = true;
      doneStep.hidden = false;
      doneStep.querySelector("[data-done-number]").textContent = result.order.number;
      doneStep.querySelector("h2").focus();
    } catch (error) {
      paymentStep.querySelector("[data-pay-status]").textContent = error.message;
      pay.disabled = false;
    }
  });
};

form.elements.applyCoupon.addEventListener("click", applyCoupon);
form.elements.country.addEventListener("change", refreshQuote);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = form.querySelector("[type=submit]");
  submit.disabled = true;
  formStatus.textContent = "";
  try {
    const placed = await post("/api/checkout", {
      shipping: shippingFromForm(),
      couponCode: appliedCoupon ?? undefined,
      note: form.elements.note.value,
    });
    setCartCount(0);
    showPayment(placed);
  } catch (error) {
    formStatus.textContent = error.message;
    submit.disabled = false;
  }
});

const start = async () => {
  const user = await loadNav();
  if (!user) {
    goToSignIn();
    return;
  }
  form.elements.name.value = user.name;
  const { cart } = await get("/api/cart");
  if (cart.items.length === 0) {
    location.assign("/cart");
    return;
  }
  await refreshQuote();
};

start();
