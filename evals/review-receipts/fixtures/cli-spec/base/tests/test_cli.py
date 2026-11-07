import unittest

from ledger.cli import main


class CliTest(unittest.TestCase):
    def test_unknown_command(self):
        self.assertEqual(main(["nope"], []), 2)


if __name__ == "__main__":
    unittest.main()
