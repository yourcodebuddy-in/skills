import unittest

from worker.poller import poll_once


class PollerTest(unittest.TestCase):
    def test_handles_items(self):
        seen = []
        self.assertEqual(poll_once(lambda: [1, 2], seen.append), 2)
        self.assertEqual(seen, [1, 2])


if __name__ == "__main__":
    unittest.main()
