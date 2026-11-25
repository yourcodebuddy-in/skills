"""The deploy builds the accounting token into the image, which runs as root.

`ARG WEBHOOK_TOKEN` + `ENV USAGEBILL_WEBHOOK_TOKEN=${WEBHOOK_TOKEN}` stores the
token in the image config, readable by anyone who can pull the image
(`docker inspect` / `docker history`), and deploy/deploy.sh passes the real
token as that build arg before pushing to the registry. Exit 0 when all of
this holds and the Dockerfile never drops root with USER.
"""
import re
import sys
from pathlib import Path

dockerfile = Path("Dockerfile").read_text()
deploy = Path("deploy/deploy.sh").read_text()

has_arg = re.search(r"^ARG WEBHOOK_TOKEN\b", dockerfile, re.M) is not None
baked = re.search(r"USAGEBILL_WEBHOOK_TOKEN=\$\{?WEBHOOK_TOKEN\}?", dockerfile) is not None
passed = re.search(r'--build-arg WEBHOOK_TOKEN="\$\{USAGEBILL_WEBHOOK_TOKEN\}"', deploy) is not None
pushed = "docker push" in deploy
runs_as_root = re.search(r"^USER\s+", dockerfile, re.M) is None
print(f"ARG={has_arg} ENV from ARG={baked} deploy passes token={passed} pushed={pushed} no USER={runs_as_root}")
sys.exit(0 if has_arg and baked and passed and pushed and runs_as_root else 1)
