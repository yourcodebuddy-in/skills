import { ApiError, get, patch, post } from "./api.js";
import { loadNav } from "./nav.js";
import {
  renderCouponRow,
  renderOrderDetail,
  renderOrderRow,
  renderProductRow,
  renderSalesReport,
} from "./admin-views.js";

const panels = document.querySelectorAll("[data-panel]");
const tabs = document.querySelectorAll("[data-tab]");
const status = document.querySelector("[data-status]");
const orderRows = document.querySelector("[data-order-rows]");
const orderDetail = document.querySelector("[data-order-detail]");
const statusFilter = document.querySelector("[data-status-filter]");
const productRows = document.querySelector("[data-product-rows]");
const productForm = document.querySelector("[data-product-form]");
const couponRows = document.querySelector("[data-coupon-rows]");
const couponForm = document.querySelector("[data-coupon-form]");
const reportForm = document.querySelector("[data-report-form]");
const report = document.querySelector("[data-report]");

let products = [];

const say = (message) => {
  status.textContent = message;
};

const dollarsToCents = (value) => Math.round(Number.parseFloat(value) * 100);

const showTab = (name) => {
  for (const tab of tabs) {
    tab.setAttribute("aria-selected", String(tab.dataset.tab === name));
  }
  for (const panel of panels) {
    panel.hidden = panel.dataset.panel !== name;
  }
};

// Orders

const loadOrders = async () => {
  const query = statusFilter.value ? `?status=${encodeURIComponent(statusFilter.value)}` : "";
  const { items } = await get(`/api/admin/orders${query}`);
  orderRows.innerHTML = items.length > 0 ? items.map(renderOrderRow).join("") : '<tr><td colspan="6">No orders.</td></tr>';
};

const openOrder = async (number) => {
  const { order } = await get(`/api/admin/orders/${encodeURIComponent(number)}`);
  orderDetail.hidden = false;
  orderDetail.innerHTML = renderOrderDetail(order);
  orderDetail.querySelector("h2").focus();
};

orderRows.addEventListener("click", (event) => {
  const button = event.target.closest("[data-open-order]");
  if (button) {
    openOrder(button.dataset.openOrder).catch((error) => say(error.message));
  }
});

orderDetail.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-fulfil]");
  if (!button) {
    return;
  }
  button.disabled = true;
  try {
    await post(`/api/admin/orders/${encodeURIComponent(button.dataset.fulfil)}/fulfil`);
    say("Marked as shipped. The customer gets an email.");
    await Promise.all([openOrder(button.dataset.fulfil), loadOrders()]);
  } catch (error) {
    say(error.message);
    button.disabled = false;
  }
});

orderDetail.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-refund]");
  if (!form) {
    return;
  }
  event.preventDefault();
  const amountCents = dollarsToCents(form.elements.amount.value);
  try {
    await post(`/api/admin/orders/${encodeURIComponent(form.dataset.refund)}/refund`, { amountCents });
    say("Refund sent.");
    await Promise.all([openOrder(form.dataset.refund), loadOrders()]);
  } catch (error) {
    say(error.message);
  }
});

statusFilter.addEventListener("change", () => loadOrders().catch((error) => say(error.message)));

// Products

const loadProducts = async () => {
  ({ items: products } = await get("/api/admin/products"));
  productRows.innerHTML = products.map(renderProductRow).join("");
};

const fillProductForm = (product) => {
  productForm.hidden = false;
  productForm.dataset.productId = product ? String(product.id) : "";
  productForm.elements.sku.value = product?.sku ?? "";
  productForm.elements.name.value = product?.name ?? "";
  productForm.elements.description.value = product?.description ?? "";
  productForm.elements.price.value = product ? (product.priceCents / 100).toFixed(2) : "";
  productForm.elements.stock.value = product ? String(product.stock) : "0";
  productForm.elements.active.checked = product?.active ?? true;
  productForm.elements.sku.focus();
};

productRows.addEventListener("click", (event) => {
  const button = event.target.closest("[data-edit-product]");
  if (button) {
    fillProductForm(products.find((product) => product.id === Number(button.dataset.editProduct)));
  }
});

document.querySelector("[data-new-product]").addEventListener("click", () => fillProductForm(null));

productForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const body = {
    sku: productForm.elements.sku.value,
    name: productForm.elements.name.value,
    description: productForm.elements.description.value,
    priceCents: dollarsToCents(productForm.elements.price.value),
    stock: Number(productForm.elements.stock.value),
    active: productForm.elements.active.checked,
  };
  const id = productForm.dataset.productId;
  try {
    await (id ? patch(`/api/admin/products/${id}`, body) : post("/api/admin/products", body));
    productForm.hidden = true;
    say(id ? "Product saved." : "Product added.");
    await loadProducts();
  } catch (error) {
    say(error.message);
  }
});

// Coupons

const loadCoupons = async () => {
  const { items } = await get("/api/admin/coupons");
  couponRows.innerHTML = items.length > 0 ? items.map(renderCouponRow).join("") : '<tr><td colspan="5">No codes yet.</td></tr>';
};

couponForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(couponForm);
  const value = Number(data.get("value"));
  const body = {
    code: data.get("code"),
    ...(data.get("kind") === "percent" ? { percentOff: value } : { amountOffCents: dollarsToCents(data.get("value")) }),
    minSubtotalCents: dollarsToCents(data.get("minimum") || "0"),
    maxRedemptions: data.get("limit") ? Number(data.get("limit")) : null,
    expiresOn: data.get("expiresOn") || null,
  };
  try {
    await post("/api/admin/coupons", body);
    couponForm.reset();
    say(`Code ${body.code.toUpperCase()} created.`);
    await loadCoupons();
  } catch (error) {
    say(error.message);
  }
});

// Sales

reportForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(reportForm);
  try {
    const result = await get(`/api/admin/reports/sales?from=${data.get("from")}&to=${data.get("to")}`);
    report.innerHTML = renderSalesReport(result);
  } catch (error) {
    say(error.message);
  }
});

for (const tab of tabs) {
  tab.addEventListener("click", () => showTab(tab.dataset.tab));
}

const start = async () => {
  const user = await loadNav();
  if (!user || user.role !== "admin") {
    document.querySelector("main").innerHTML = '<p class="empty">This page is for staff. <a href="/account?next=/admin">Sign in</a> with a staff account.</p>';
    return;
  }
  showTab("orders");
  try {
    await Promise.all([loadOrders(), loadProducts(), loadCoupons()]);
  } catch (error) {
    say(error instanceof ApiError ? error.message : "The admin data didn't load.");
  }
};

start();
