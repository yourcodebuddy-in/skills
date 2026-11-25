import { randomUUID } from "node:crypto";

const toLine = (row) => ({
  productId: row.product_id,
  sku: row.sku,
  name: row.name,
  quantity: row.quantity,
  unitPriceCents: row.unit_price_cents,
  stock: row.stock,
  active: row.active === 1,
});

export const cartRepo = (db) => {
  const forUser = db.prepare("SELECT id, user_id, created_at FROM carts WHERE user_id = ?");
  const lines = db.prepare(`
    SELECT cart_items.product_id, cart_items.quantity, cart_items.unit_price_cents,
           products.sku, products.name, products.stock, products.active
    FROM cart_items JOIN products ON products.id = cart_items.product_id
    WHERE cart_items.cart_id = ?
    ORDER BY cart_items.added_at, cart_items.product_id
  `);
  const upsert = db.prepare(`
    INSERT INTO cart_items (cart_id, product_id, quantity, unit_price_cents, added_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (cart_id, product_id)
    DO UPDATE SET quantity = excluded.quantity, unit_price_cents = excluded.unit_price_cents
  `);

  const findForUser = (userId) => {
    const row = forUser.get(userId);
    return row ? { id: row.id, userId: row.user_id, createdAt: row.created_at } : null;
  };

  return {
    findForUser,

    openForUser: (userId, now) => {
      const existing = findForUser(userId);
      if (existing) {
        return existing;
      }
      const id = randomUUID();
      db.prepare("INSERT INTO carts (id, user_id, created_at) VALUES (?, ?, ?)").run(id, userId, now);
      return { id, userId, createdAt: now };
    },

    lines: (cartId) => lines.all(cartId).map(toLine),

    putLine: (cartId, { productId, quantity, unitPriceCents }, now) => {
      upsert.run(cartId, productId, quantity, unitPriceCents, now);
    },

    setQuantity: (cartId, productId, quantity) =>
      db.prepare("UPDATE cart_items SET quantity = ? WHERE cart_id = ? AND product_id = ?").run(quantity, cartId, productId)
        .changes === 1,

    removeLine: (cartId, productId) =>
      db.prepare("DELETE FROM cart_items WHERE cart_id = ? AND product_id = ?").run(cartId, productId).changes === 1,

    clear: (cartId) => {
      db.prepare("DELETE FROM cart_items WHERE cart_id = ?").run(cartId);
    },
  };
};
