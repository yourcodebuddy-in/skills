import { ApiError, del, get, goToSignIn, patch } from "./api.js";
import { renderSummary } from "./cart-summary.js";
import { loadNav, setCartCount } from "./nav.js";
import { renderCartLine, renderEmpty } from "./views.js";

const list = document.querySelector("[data-lines]");
const summary = document.querySelector("[data-summary]");
const checkoutLink = document.querySelector("[data-checkout]");
const status = document.querySelector("[data-status]");

const render = (cart) => {
  setCartCount(cart.itemCount);
  if (cart.items.length === 0) {
    list.innerHTML = renderEmpty("Your cart is empty.", '<a class="button" href="/">Browse the shop</a>');
    summary.innerHTML = "";
    checkoutLink.hidden = true;
    return;
  }
  list.innerHTML = cart.items.map(renderCartLine).join("");
  summary.innerHTML = renderSummary(cart);
  checkoutLink.hidden = cart.items.some((item) => !item.available);
};

const handle = async (work) => {
  try {
    const { cart } = await work();
    render(cart);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      goToSignIn();
      return;
    }
    status.textContent = error.message;
  }
};

list.addEventListener("change", (event) => {
  if (!event.target.matches("[data-quantity]")) {
    return;
  }
  const productId = event.target.closest("[data-product]").dataset.product;
  handle(() => patch(`/api/cart/items/${productId}`, { quantity: Number(event.target.value) }));
});

list.addEventListener("click", (event) => {
  if (!event.target.matches("[data-remove]")) {
    return;
  }
  const productId = event.target.closest("[data-product]").dataset.product;
  handle(() => del(`/api/cart/items/${productId}`));
});

loadNav();
handle(() => get("/api/cart"));
