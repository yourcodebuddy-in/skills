import unittest

from game.entities import Enemy


class EnemyTest(unittest.TestCase):
    def test_moves_by_speed_times_dt(self):
        enemy = Enemy()
        enemy.update(0.5)
        self.assertEqual(enemy.x, 60.0)


if __name__ == "__main__":
    unittest.main()
