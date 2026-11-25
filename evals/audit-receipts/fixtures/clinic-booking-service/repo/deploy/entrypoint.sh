#!/bin/sh
# Container entrypoint: the API container applies migrations before it starts serving.
set -eu

command="${1:-serve}"

if [ "$command" = "serve" ]; then
    python -m clinicbook migrate
fi

exec python -m clinicbook "$@"
