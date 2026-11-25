import { escapeHtml } from "./escape.js";
import { formatPrice } from "./format.js";

export const renderProductCard = (product) => `
  <article class="product" aria-labelledby="product-${Number(product.id)}">
    <div class="product-art" aria-hidden="true">${escapeHtml(product.name.slice(0, 1))}</div>
    <h3 id="product-${Number(product.id)}">${escapeHtml(product.name)}</h3>
    <p class="product-description">${escapeHtml(product.description)}</p>
    <p class="price">${formatPrice(product.priceCents)}</p>
    <button type="button" class="button" data-add="${Number(product.id)}" ${product.inStock ? "" : "disabled"}>
      ${product.inStock ? "Add to cart" : "Sold out"}
    </button>
  </article>`;

const quantityOptions = (selected, max = 10) => {
  let options = "";
  for (let quantity = 1; quantity <= max; quantity += 1) {
    options += `<option value="${quantity}" ${quantity === selected ? "selected" : ""}>${quantity}</option>`;
  }
  return options;
};

export const renderCartLine = (item) => `
  <li class="cart-line" data-product="${Number(item.productId)}">
    <div>
      <p class="cart-line-name">${escapeHtml(item.name)}</p>
      <p class="muted">${formatPrice(item.unitPriceCents)} each${item.available ? "" : " · no longer available in this quantity"}</p>
    </div>
    <label class="visually-hidden" for="qty-${Number(item.productId)}">Quantity of ${escapeHtml(item.name)}</label>
    <select id="qty-${Number(item.productId)}" data-quantity>${quantityOptions(item.quantity)}</select>
    <p class="cart-line-total">${formatPrice(item.lineTotalCents)}</p>
    <button type="button" class="link-button" data-remove>Remove</button>
  </li>`;

export const renderEmpty = (message, action = "") => `
  <div class="empty">
    <p>${escapeHtml(message)}</p>
    ${action}
  </div>`;
