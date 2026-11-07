import unittest

from httpkit import fetch


class FetchTest(unittest.TestCase):
    def test_default(self):
        self.assertEqual(fetch("u")["url"], "u")


if __name__ == "__main__":
    unittest.main()
