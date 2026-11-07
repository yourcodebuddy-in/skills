import os, sys
sys.path.insert(0, os.getcwd())
from model.data import prepare
train, test = prepare([1.0, 2.0, 3.0, 4.0, 100.0])
sys.exit(0 if max(train) < 0.1 and max(test) == 1.0 else 1)
