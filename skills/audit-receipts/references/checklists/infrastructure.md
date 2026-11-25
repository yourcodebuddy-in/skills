# CI, infrastructure, containers, shell, config, dependencies

- **CI trust:** can code from a fork or an untrusted branch run with secrets or write permissions? For example, `pull_request_target` with a checkout of the PR head.
- **CI injection:** is an untrusted value such as a PR title or branch name placed directly in a shell step? Pass it through an environment variable.
- **CI controls:** is any test, lint, scan, or required check weakened, skipped, or allowed to fail? Are third-party actions and images pinned?
- **Least privilege:** is each permission, role, and token the minimum the job needs?
- **Exposure:** is any port, bucket, database, or admin interface open to the internet? Check the actual source ranges and public flags.
- **Blast radius:** will this destroy and recreate a resource holding data? Are deletion protection and backups kept?
- **Rollout:** can it fail halfway, and can it be rolled back? Are health checks, resource limits, and ordering right?
- **Shell safety:** are variables quoted? Is `set -e` or an explicit check present before anything destructive? What does `rm -rf` do if a variable is empty or a `cd` fails? Does parsing `ls` break on odd filenames?
- **Secrets:** are any committed, printed in logs, or baked into images?
- **Config failure:** does a missing value fail clearly, or does a default hide a broken deployment? Do environments differ in a way that invalidates an assumption?
- **Dependencies:** does each one solve a current problem better than existing code or the standard library? Does the package exist and is it the intended one, not a lookalike? Check the version and license.
- **Unused dependencies:** is anything declared that nothing imports, or used but not declared?
- **Containers:** does the image run as root unnecessarily, use an unpinned base, or leave secrets in a layer?
