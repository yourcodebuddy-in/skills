import { ApiError, get, post } from "./api.js";
import { escapeHtml } from "./escape.js";
import { formatDate, formatPrice, statusLabel } from "./format.js";
import { loadNav, signOut } from "./nav.js";

const signedOut = document.querySelector("[data-signed-out]");
const signedIn = document.querySelector("[data-signed-in]");
const ordersList = document.querySelector("[data-orders]");

// Only paths on this site, so a crafted link can't send someone elsewhere after signing in.
const nextPath = () => {
  const next = new URLSearchParams(location.search).get("next") ?? "/";
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
};

const renderOrder = (order) => `
  <li class="order-line">
    <span class="order-number">${escapeHtml(order.number)}</span>
    <span>${formatDate(order.createdAt)}</span>
    <span>${order.itemCount} ${order.itemCount === 1 ? "item" : "items"}</span>
    <span>${formatPrice(order.totalCents)}</span>
    <span class="status status-${escapeHtml(order.status)}">${escapeHtml(statusLabel(order.status))}</span>
  </li>`;

const bindForm = (form, path, toBody) => {
  const status = form.querySelector("[data-form-status]");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    status.textContent = "";
    const submit = form.querySelector("[type=submit]");
    submit.disabled = true;
    try {
      await post(path, toBody(new FormData(form)));
      location.assign(nextPath());
    } catch (error) {
      status.textContent = error instanceof ApiError ? error.message : "Something went wrong. Try again.";
      submit.disabled = false;
    }
  });
};

bindForm(document.querySelector("[data-login]"), "/api/account/login", (data) => ({
  email: data.get("email"),
  password: data.get("password"),
}));

bindForm(document.querySelector("[data-register]"), "/api/account/register", (data) => ({
  name: data.get("name"),
  email: data.get("email"),
  password: data.get("password"),
}));

document.querySelector("[data-sign-out]").addEventListener("click", signOut);

const start = async () => {
  const user = await loadNav();
  signedOut.hidden = Boolean(user);
  signedIn.hidden = !user;
  if (!user) {
    return;
  }
  signedIn.querySelector("[data-user-name]").textContent = user.name;
  const { items } = await get("/api/orders");
  ordersList.innerHTML =
    items.length > 0 ? items.map(renderOrder).join("") : '<li class="muted">You haven\'t ordered anything yet.</li>';
};

start();
