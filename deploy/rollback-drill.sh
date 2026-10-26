#!/usr/bin/env bash
# Verify recreation of the saved previous image without touching production.
set -euo pipefail
PREVIOUS=$(cat /opt/riftden/backups/previous-image.txt)
CANDIDATE=${1:?Pass a candidate image}
NAME=riftden-rollback-drill
cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT
run() {
  docker run -d --name "$NAME" -p 127.0.0.1:3017:3000 "$1" >/dev/null
  curl --retry 20 --retry-delay 1 --retry-all-errors -fsS http://127.0.0.1:3017/robots.txt >/dev/null
}
run "$CANDIDATE"
curl -fsS http://127.0.0.1:3017/health.json >/dev/null
cleanup
run "$PREVIOUS"
ACTUAL=$(docker inspect -f '{{.Image}}' "$NAME")
[ "$ACTUAL" = "$PREVIOUS" ]
curl -fsS http://127.0.0.1:3017/champions/garen >/dev/null
echo "Rollback drill passed: previous image $PREVIOUS serves pages"
