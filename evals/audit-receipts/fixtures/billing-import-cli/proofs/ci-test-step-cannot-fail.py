"""The CI test step pipes into tee without pipefail, so failing tests pass CI.

GitHub Actions runs a `run:` step with no `shell:` on Linux as `bash -e {0}`
(pipefail is only added when `shell: bash` is given explicitly), so a pipeline's
exit status is tee's. Exit 0 when the workflow has that shape and the same
pipeline run under `bash -e` with a failing test command exits 0.
"""
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

workflow = Path(".github/workflows/ci.yml").read_text()
step = re.search(r"- name: Run tests\n\s+run: (.+)\n", workflow)
command = step.group(1) if step else ""
shape_ok = "| tee" in command and "pipefail" not in workflow and "shell:" not in workflow

with tempfile.TemporaryDirectory() as tmp:
    script = Path(tmp) / "step.sh"
    failing = command.replace("python -m unittest discover -s tests -v", f'"{sys.executable}" -c "import sys; sys.exit(1)"')
    script.write_text(failing + "\n")
    result = subprocess.run(["bash", "-e", str(script)], cwd=tmp, capture_output=True, timeout=60)
print(f"step: {command!r}; no shell/pipefail: {shape_ok}; failing pipeline exit code under bash -e: {result.returncode}")
sys.exit(0 if shape_ok and failing != command and result.returncode == 0 else 1)
