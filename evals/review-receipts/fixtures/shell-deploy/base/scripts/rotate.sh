#!/bin/sh
# Keeps the newest five releases under $RELEASES_DIR.
set -eu
ls -1t "$RELEASES_DIR" | tail -n +6
