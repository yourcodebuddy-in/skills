import sqlite3
import unittest

from catalog.handlers import products_page


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


if __name__ == "__main__":
    unittest.main()
