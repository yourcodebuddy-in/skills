import os, sys
sys.path.insert(0, os.getcwd())
from game.entities import Player
a = Player(); a.moving = True
b = Player(); b.moving = True
for _ in range(30): a.update(1 / 30)
for _ in range(60): b.update(1 / 60)
sys.exit(0 if a.x != b.x else 1)
