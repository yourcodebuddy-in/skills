grep -q "^cd \$RELEASES_DIR" scripts/rotate.sh && ! grep -q "set -e" scripts/rotate.sh && grep -q "rm -rf \$old" scripts/rotate.sh
