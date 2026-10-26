#!/usr/bin/env bash
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
exec 9>/opt/riftden/release.lock
flock -n 9 || exit 1
IMAGE=$(cat /opt/riftden/backups/previous-image.txt)
docker image inspect "$IMAGE" >/dev/null
RIFTDEN_IMAGE="$IMAGE" docker compose -f "$ROOT/deploy/compose.yml" up -d --no-deps web
docker exec riftden-nginx nginx -s reload
curl --retry 10 --retry-delay 1 --retry-all-errors -fsS https://riftden.com/robots.txt
