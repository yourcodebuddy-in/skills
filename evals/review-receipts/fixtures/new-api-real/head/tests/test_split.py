import unittest

from batching.split import split, split_exact


class SplitTest(unittest.TestCase):
    def test_split(self):
        self.assertEqual(split([1, 2, 3], 2), [[1, 2], [3]])

    def test_split_exact_rejects_a_short_batch(self):
        with self.assertRaises(ValueError):
            split_exact([1, 2, 3], 2)


if __name__ == "__main__":
    unittest.main()
