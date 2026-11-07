import os, sys
sys.path.insert(0, os.getcwd())
from catalog.params import Sort, parse_sort
for bad in ["x:asc", "name:x", "name; DROP TABLE p:asc", "price_cents:asc"]:
    try:
        parse_sort(bad); sys.exit(1)
    except ValueError:
        pass
try:
    Sort("id--", "ASC"); sys.exit(1)
except ValueError:
    sys.exit(0)
