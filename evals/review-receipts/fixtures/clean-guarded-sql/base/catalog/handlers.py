from catalog.repo import list_products

MAX_LIMIT = 100


def products_page(conn, query):
    limit = min(int(query.get("limit", 20)), MAX_LIMIT)
    offset = max(int(query.get("offset", 0)), 0)
    return list_products(conn, limit, offset)
