from pathlib import Path
import sys
s=Path("worker/poller.py").read_text()
sys.exit(0 if "elapsed_ms" in s and "seconds" in s else 1)
