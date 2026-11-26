#!/bin/sh
# Deploys the checked-out commit to the production host.
#
#   scripts/deploy.sh [host]
#
# Needs ssh access as the deploy user. The host keeps each release in /srv/boxoffice/releases,
# shared state (database, .env, backups) in /srv/boxoffice/shared, and points
# /srv/boxoffice/current at the live release. systemd runs the web server and the worker
# from /srv/boxoffice/current (see deploy/).
set -u

HOST="${1:-${DEPLOY_HOST:-tickets.internal}}"
APP_DIR=/srv/boxoffice
RELEASE="$(date -u +%Y%m%d%H%M%S)-$(git rev-parse --short HEAD)"
RELEASE_DIR="$APP_DIR/releases/$RELEASE"
SHARED="$APP_DIR/shared"

echo "Deploying $RELEASE to $HOST"

ssh "$HOST" "mkdir -p '$RELEASE_DIR' '$SHARED/backups'"
git archive --format=tar HEAD | ssh "$HOST" "tar -x -C '$RELEASE_DIR'"
ssh "$HOST" "ln -sfn '$SHARED/data' '$RELEASE_DIR/data'"

echo "Backing up the database"
ssh "$HOST" "sqlite3 '$SHARED/data/boxoffice.db' \".backup '$SHARED/backups/pre-$RELEASE.db'\""

echo "Running migrations"
ssh "$HOST" "cd '$RELEASE_DIR' && set -a && . '$SHARED/.env' && set +a && node bin/boxoffice.js migrate"

echo "Switching to $RELEASE"
ssh "$HOST" "ln -sfn '$RELEASE_DIR' '$APP_DIR/current'"
ssh "$HOST" "sudo systemctl restart boxoffice-web boxoffice-worker"

# Keep the five newest releases and the ten newest backups.
ssh "$HOST" "cd '$APP_DIR/releases' && ls -1t | tail -n +6 | xargs -r rm -rf"
ssh "$HOST" "cd '$SHARED/backups' && ls -1t | tail -n +11 | xargs -r rm -f"

echo "Deployed $RELEASE"
