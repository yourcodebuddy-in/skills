import {
  ConflictError,
  NotFoundError,
  parseCartLine,
  parseId,
  parseQuantity,
  planAddition,
  summarizeCart,
} from "../../../../packages/core/src/index.js";

const USER = { auth: "user" };

export const cartRoutes = (router, { store }) => {
  const currentCart = (userId) => {
    const cart = store.carts.findForUser(userId);
    return summarizeCart(cart ? store.carts.lines(cart.id) : []);
  };

  router.get("/api/cart", ({ user }) => ({ body: { cart: currentCart(user.id) } }), USER);

  router.post(
    "/api/cart/items",
    ({ user, body, now }) => {
      const line = parseCartLine(body);
      const product = store.products.find(line.productId);
      const at = now.toISOString();
      store.transaction(() => {
        const cart = store.carts.openForUser(user.id, at);
        const planned = planAddition({ lines: store.carts.lines(cart.id), product, quantity: line.quantity });
        store.carts.putLine(cart.id, { ...planned, unitPriceCents: line.unitPriceCents ?? product.priceCents }, at);
      });
      return { status: 201, body: { cart: currentCart(user.id) } };
    },
    USER,
  );

  router.patch(
    "/api/cart/items/:productId",
    ({ user, params, body }) => {
      const productId = parseId(params.productId, "productId");
      const quantity = parseQuantity(body.quantity);
      const product = store.products.find(productId);
      if (product && quantity > product.stock) {
        throw new ConflictError("There isn't enough stock for this item", "out_of_stock", { productId });
      }
      const cart = store.carts.findForUser(user.id);
      if (!cart || !store.carts.setQuantity(cart.id, productId, quantity)) {
        throw new NotFoundError("cart item");
      }
      return { body: { cart: currentCart(user.id) } };
    },
    USER,
  );

  router.delete(
    "/api/cart/items/:productId",
    ({ user, params }) => {
      const productId = parseId(params.productId, "productId");
      const cart = store.carts.findForUser(user.id);
      if (!cart || !store.carts.removeLine(cart.id, productId)) {
        throw new NotFoundError("cart item");
      }
      return { body: { cart: currentCart(user.id) } };
    },
    USER,
  );
};
