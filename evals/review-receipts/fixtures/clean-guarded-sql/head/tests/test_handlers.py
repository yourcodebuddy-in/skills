import sqlite3
import unittest

from catalog.handlers import products_page
from catalog.params import Sort, parse_sort


def database():
    conn = sqlite3.connect(":memory:")
    conn.execute("CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, price_cents INTEGER)")
    conn.executemany(
        "INSERT INTO products VALUES (?, ?, ?)",
        [(1, "Lamp", 3000), (2, "Desk", 15000), (3, "Chair", 8000)],
    )
    return conn


class ProductsPageTest(unittest.TestCase):
    def test_default_order(self):
        self.assertEqual([row[0] for row in products_page(database(), {})], [1, 2, 3])

    def test_sort_by_price_desc(self):
        rows = products_page(database(), {"sort": "price:desc"})
        self.assertEqual([row[0] for row in rows], [2, 3, 1])

    def test_rejects_unknown_sort(self):
        for raw in ["password:asc", "name:sideways", "name; DROP TABLE products:asc"]:
            with self.assertRaises(ValueError):
                parse_sort(raw)

    def test_sort_cannot_hold_arbitrary_sql(self):
        with self.assertRaises(ValueError):
            Sort("id; DROP TABLE products", "ASC")


if __name__ == "__main__":
    unittest.main()
