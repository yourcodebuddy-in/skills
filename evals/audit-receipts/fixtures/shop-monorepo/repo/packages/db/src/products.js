const SORTS = Object.freeze({
  newest: "created_at DESC, id DESC",
  price_asc: "price_cents ASC, id ASC",
  price_desc: "price_cents DESC, id DESC",
  name: "name COLLATE NOCASE ASC, id ASC",
});

const orderBy = (sort) => (Object.hasOwn(SORTS, sort) ? SORTS[sort] : SORTS.newest);

const LIKE_SPECIAL = /[\\%_]/g;
const likePattern = (text) => `%${text.replace(LIKE_SPECIAL, (match) => `\\${match}`)}%`;

const toProduct = (row) =>
  row && {
    id: row.id,
    sku: row.sku,
    name: row.name,
    description: row.description,
    priceCents: row.price_cents,
    stock: row.stock,
    active: row.active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

const COLUMNS = Object.freeze({
  sku: "sku",
  name: "name",
  description: "description",
  priceCents: "price_cents",
  stock: "stock",
  active: "active",
});

export const productRepo = (db) => {
  const byId = db.prepare("SELECT * FROM products WHERE id = ?");
  const take = db.prepare("UPDATE products SET stock = stock - ? WHERE id = ? AND active = 1 AND stock >= ?");
  const restore = db.prepare("UPDATE products SET stock = stock + ? WHERE id = ?");

  return {
    find: (id) => toProduct(byId.get(id)),

    list: ({ search = null, sort = "newest", limit = 24, offset = 0, includeInactive = false } = {}) => {
      const where = [];
      const params = [];
      if (!includeInactive) {
        where.push("active = 1");
      }
      if (search) {
        where.push("name LIKE ? ESCAPE '\\'");
        params.push(likePattern(search));
      }
      const clause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
      const rows = db
        .prepare(`SELECT * FROM products ${clause} ORDER BY ${orderBy(sort)} LIMIT ? OFFSET ?`)
        .all(...params, limit, offset);
      const { total } = db.prepare(`SELECT COUNT(*) AS total FROM products ${clause}`).get(...params);
      return { items: rows.map(toProduct), total };
    },

    create: (product, now) => {
      const result = db
        .prepare(
          `INSERT INTO products (sku, name, description, price_cents, stock, active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          product.sku,
          product.name,
          product.description ?? "",
          product.priceCents,
          product.stock ?? 0,
          product.active === false ? 0 : 1,
          now,
          now,
        );
      return toProduct(byId.get(result.lastInsertRowid));
    },

    update: (id, changes, now) => {
      const sets = [];
      const params = [];
      for (const [key, column] of Object.entries(COLUMNS)) {
        if (changes[key] === undefined) {
          continue;
        }
        sets.push(`${column} = ?`);
        params.push(key === "active" ? Number(changes.active) : changes[key]);
      }
      if (sets.length > 0) {
        db.prepare(`UPDATE products SET ${sets.join(", ")}, updated_at = ? WHERE id = ?`).run(...params, now, id);
      }
      return toProduct(byId.get(id));
    },

    // Takes stock only if there is enough, so two checkouts can't both take the last unit.
    takeStock: (id, quantity) => take.run(quantity, id, quantity).changes === 1,

    restoreStock: (id, quantity) => {
      restore.run(quantity, id);
    },
  };
};
