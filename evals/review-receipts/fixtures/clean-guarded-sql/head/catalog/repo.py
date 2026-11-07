from catalog.params import Sort


def list_products(conn, sort: Sort, limit, offset):
    rows = conn.execute(
        f"SELECT id, name, price_cents FROM products ORDER BY {sort.column} {sort.direction}, id ASC LIMIT ? OFFSET ?",
        (limit, offset),
    )
    return rows.fetchall()
