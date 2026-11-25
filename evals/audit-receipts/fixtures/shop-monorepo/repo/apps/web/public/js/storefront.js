import { ApiError, get, goToSignIn, post } from "./api.js";
import { loadNav, setCartCount } from "./nav.js";
import { renderEmpty, renderProductCard } from "./views.js";

const grid = document.querySelector("[data-products]");
const form = document.querySelector("[data-filters]");
const status = document.querySelector("[data-status]");
const pager = document.querySelector("[data-pager]");

let products = [];
let page = 1;

const say = (message) => {
  status.textContent = message;
};

const load = async () => {
  const params = new URLSearchParams(new FormData(form));
  params.set("page", String(page));
  grid.setAttribute("aria-busy", "true");
  try {
    const result = await get(`/api/products?${params}`);
    products = result.items;
    grid.innerHTML =
      products.length > 0 ? products.map(renderProductCard).join("") : renderEmpty("Nothing matches that search.");
    const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
    pager.hidden = pages === 1;
    pager.querySelector("[data-page-label]").textContent = `Page ${page} of ${pages}`;
    pager.querySelector("[data-prev]").disabled = page === 1;
    pager.querySelector("[data-next]").disabled = page === pages;
  } catch {
    grid.innerHTML = renderEmpty("The catalogue didn't load. Check your connection and try again.");
  } finally {
    grid.removeAttribute("aria-busy");
  }
};

const addToCart = async (button) => {
  const product = products.find((item) => item.id === Number(button.dataset.add));
  if (!product) {
    return;
  }
  button.disabled = true;
  try {
    const { cart } = await post("/api/cart/items", { productId: product.id, quantity: 1, priceCents: product.priceCents });
    setCartCount(cart.itemCount);
    say(`${product.name} added to your cart.`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      goToSignIn();
      return;
    }
    say(error.message);
  } finally {
    button.disabled = false;
  }
};

grid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-add]");
  if (button) {
    addToCart(button);
  }
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  page = 1;
  load();
});

form.querySelector("select").addEventListener("change", () => {
  page = 1;
  load();
});

pager.addEventListener("click", (event) => {
  if (event.target.matches("[data-prev]")) {
    page -= 1;
  } else if (event.target.matches("[data-next]")) {
    page += 1;
  } else {
    return;
  }
  load();
});

loadNav();
load();
