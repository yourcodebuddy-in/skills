import { MAX_CART_LINES, MAX_LINE_QUANTITY } from "./constants.js";
import { ConflictError, NotFoundError, ValidationError } from "./errors.js";
import { lineTotal } from "./pricing.js";
import { sumCents } from "./money.js";

// Works out the line to store when a shopper adds a product, given the cart as it is now.
export const planAddition = ({ lines, product, quantity }) => {
  if (!product || !product.active) {
    throw new NotFoundError("product");
  }
  const existing = lines.find((line) => line.productId === product.id);
  if (!existing && lines.length >= MAX_CART_LINES) {
    throw new ConflictError(`A cart can hold at most ${MAX_CART_LINES} different products`, "cart_full");
  }
  const nextQuantity = (existing?.quantity ?? 0) + quantity;
  if (nextQuantity > MAX_LINE_QUANTITY) {
    throw new ValidationError(`You can buy at most ${MAX_LINE_QUANTITY} of one product`, { field: "quantity" });
  }
  if (nextQuantity > product.stock) {
    throw new ConflictError("There isn't enough stock for this item", "out_of_stock", { productId: product.id });
  }
  return { productId: product.id, quantity: nextQuantity };
};

export const summarizeCart = (lines) => {
  const items = lines.map((line) => ({
    productId: line.productId,
    sku: line.sku,
    name: line.name,
    quantity: line.quantity,
    unitPriceCents: line.unitPriceCents,
    lineTotalCents: lineTotal(line),
    available: line.active && line.stock >= line.quantity,
  }));
  return {
    items,
    itemCount: items.reduce((count, item) => count + item.quantity, 0),
    subtotalCents: sumCents(items.map((item) => item.lineTotalCents)),
  };
};
