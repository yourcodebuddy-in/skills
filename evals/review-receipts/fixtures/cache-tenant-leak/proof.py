import os, sys
sys.path.insert(0, os.getcwd())
from reports.cache import clear
from reports.summary import monthly_summary
class Db:
    def invoices_for(self, tenant_id, month):
        return [{"cents": 100 if tenant_id == "a" else 999}]
clear()
monthly_summary(Db(), "a", "m")
sys.exit(0 if monthly_summary(Db(), "b", "m")["total_cents"] == 100 else 1)
