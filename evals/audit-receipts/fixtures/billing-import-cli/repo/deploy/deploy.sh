#!/usr/bin/env bash
# Build the usagebill image, push it, and roll it out to the billing host.
#
# Usage: deploy/deploy.sh <environment>
#   environment: staging | production
#
# Needs: REGISTRY, USAGEBILL_WEBHOOK_TOKEN, and SSH access to the billing host.

set -euo pipefail

ENVIRONMENT="${1:-}"
case "$ENVIRONMENT" in
  staging) HOST="billing-staging.internal" ;;
  production) HOST="billing.internal" ;;
  *)
    echo "usage: $0 staging|production" >&2
    exit 64
    ;;
esac

: "${REGISTRY:?REGISTRY must be set}"
: "${USAGEBILL_WEBHOOK_TOKEN:?USAGEBILL_WEBHOOK_TOKEN must be set}"

GIT_SHA="$(git rev-parse --short HEAD)"
IMAGE="${REGISTRY}/usagebill:${GIT_SHA}"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "working tree has uncommitted changes; commit or stash them first" >&2
  exit 1
fi

echo "building ${IMAGE}"
docker build \
  --build-arg GIT_SHA="${GIT_SHA}" \
  --build-arg WEBHOOK_TOKEN="${USAGEBILL_WEBHOOK_TOKEN}" \
  -t "${IMAGE}" .

echo "pushing ${IMAGE}"
docker push "${IMAGE}"

echo "migrating ${ENVIRONMENT}"
ssh "deploy@${HOST}" "docker run --rm -v usagebill-data:/data ${IMAGE} migrate"

echo "switching ${ENVIRONMENT} to ${GIT_SHA}"
ssh "deploy@${HOST}" "echo ${IMAGE} > /etc/usagebill/image && systemctl restart usagebill-cron.timer"

echo "done: ${ENVIRONMENT} now runs ${GIT_SHA}"
