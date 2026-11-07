import os, sys
sys.path.insert(0, os.getcwd())
from etl.revenue import revenue_by_region
r = revenue_by_region([{"customer_id": 1, "cents": 100}], [{"customer_id": 1, "region": "EU", "is_primary": True}, {"customer_id": 1, "region": "US", "is_primary": False}])
sys.exit(0 if sum(r.values()) == 200 else 1)
