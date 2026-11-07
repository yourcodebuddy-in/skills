import os,sys
sys.path.insert(0,os.getcwd())
from httpkit import fetch
try:
    fetch("u",timeout=5); sys.exit(1)
except TypeError:
    sys.exit(0)
