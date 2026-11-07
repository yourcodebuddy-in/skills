import os, sys, time
from types import SimpleNamespace
sys.path.insert(0, os.getcwd())
from billing.gateway import GatewayTimeout
from billing.service import charge_order
time.sleep = lambda _s: None
class Orders:
    order = SimpleNamespace(customer_id="c", amount_cents=500)
    paid = "unset"
    def get(self, _): return self.order
    def mark_paid(self, _, r): self.paid = r
class CapturedThenTimeout:
    captured = 0
    def charge(self, c, a, idempotency_key=None):
        self.captured += 1
        if self.captured == 1: raise GatewayTimeout()
        return "r"
class AlwaysTimeout:
    def charge(self, c, a, idempotency_key=None): raise GatewayTimeout()
g = CapturedThenTimeout(); charge_order(g, Orders(), "o")
o = Orders(); charge_order(AlwaysTimeout(), o, "o")
sys.exit(0 if g.captured == 2 and o.paid is None else 1)
