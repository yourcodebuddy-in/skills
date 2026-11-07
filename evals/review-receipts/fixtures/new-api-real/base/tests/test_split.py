import unittest

from batching.split import split


class SplitTest(unittest.TestCase):
    def test_split(self):
        self.assertEqual(split([1, 2, 3], 2), [[1, 2], [3]])


if __name__ == "__main__":
    unittest.main()
