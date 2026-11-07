import os,sys
sys.path.insert(0,os.getcwd())
from batching.split import split,split_exact
assert split([1,2,3],2)==[[1,2],[3]]
assert split_exact([1,2],2)==[[1,2]]
try:
    split_exact([1],2); sys.exit(1)
except ValueError:
    sys.exit(0)
