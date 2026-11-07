def list_products(conn, limit, offset):
    rows = conn.execute(
        "SELECT id, name, price_cents FROM products ORDER BY id ASC LIMIT ? OFFSET ?",
        (limit, offset),
    )
    return rows.fetchall()
