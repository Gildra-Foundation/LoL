#!/usr/bin/env bash
# Deploy the current reviewed checkout. Never fetch/reset or delete previous images.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"
exec 9>/opt/riftden/release.lock
flock -n 9 || { echo 'Another release is running' >&2; exit 1; }
TAG=${RIFTDEN_RELEASE_TAG:-release-$(date -u +%Y%m%d-%H%M%S)}
IMAGE="riftden-web:$TAG"
PREVIOUS=$(docker inspect -f '{{.Image}}' riftden-web)
mkdir -p /opt/riftden/backups
printf '%s\n' "$PREVIOUS" > /opt/riftden/backups/previous-image.txt
npm ci --no-audit --no-fund
npm run verify
docker build --build-arg SITE_URL=https://riftden.com \
  --build-arg PLAUSIBLE_SCRIPT_URL=https://riftden.com/stats/js/script.js \
  --build-arg PLAUSIBLE_API_URL=/stats/api/event \
  --build-arg PLAUSIBLE_SITE_DOMAIN=riftden.com \
  -t "$IMAGE" .
CANDIDATE="riftden-candidate-$TAG"
SWITCHED=false
cleanup() {
  mkdir -p artifacts
  docker logs "$CANDIDATE" > "artifacts/$TAG-container.log" 2>&1 || true
  docker rm -f "$CANDIDATE" >/dev/null 2>&1 || true
}
restore() {
  if [ "$SWITCHED" = true ]; then
    RIFTDEN_IMAGE="$PREVIOUS" docker compose -f deploy/compose.yml up -d --no-deps web
    docker exec riftden-nginx nginx -s reload
    SWITCHED=false
  fi
}
trap cleanup EXIT
trap 'restore' ERR
docker run -d --tmpfs /app/apps/lol/.next/cache/images:size=134217728,uid=1000,gid=1000,mode=0755 --name "$CANDIDATE" -p 127.0.0.1:3015:3000 "$IMAGE"
for attempt in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3015/health.json >/dev/null; then break; fi
  sleep 1
done
SMOKE_BASE_URL=http://127.0.0.1:3015 npm run smoke
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3015 npm run test:e2e
# База аккаунтов: поднимается один раз и при откате сайта не трогается; миграции применяет сам сайт при запуске.
docker compose -f deploy/compose.yml up -d --wait db
SWITCHED=true
RIFTDEN_IMAGE="$IMAGE" docker compose -f deploy/compose.yml up -d --no-deps web
# nginx.conf смонтирован файлом: после git checkout контейнер видит старую копию — тогда пересоздаём nginx.
# Иначе достаточно reload (заново резолвит адрес web после замены контейнера).
if ! docker exec riftden-nginx cat /etc/nginx/conf.d/default.conf | cmp -s - deploy/nginx.conf; then
  docker compose -f deploy/compose.yml up -d --no-deps --force-recreate nginx
fi
if ! docker exec riftden-nginx nginx -s reload; then
  restore
  exit 1
fi
for attempt in $(seq 1 30); do
  if curl -fsS https://riftden.com/health.json >/dev/null; then break; fi
  sleep 1
done
if ! SMOKE_BASE_URL=https://riftden.com npm run smoke; then
  restore
  echo 'Public checks failed: previous image restored' >&2
  exit 1
fi
SWITCHED=false
printf '%s\n' "$IMAGE" > /opt/riftden/backups/current-image.txt
echo "Released $IMAGE; rollback image $PREVIOUS"
