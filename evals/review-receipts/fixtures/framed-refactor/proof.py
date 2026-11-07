import os,sys
sys.path.insert(0,os.getcwd())
from risk.limits import needs_review
sys.exit(0 if needs_review(50_000) is False else 1)
