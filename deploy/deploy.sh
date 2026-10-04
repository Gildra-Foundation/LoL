#!/usr/bin/env bash
# Выкладка riftden.com на сервере: свежий код из GitHub, сборка образа, перезапуск контейнеров.
# Запуск на сервере: /opt/riftden/app/deploy/deploy.sh
set -euo pipefail

APP=/opt/riftden/app
cd "$APP"

git fetch --quiet origin
git reset --quiet --hard origin/main
git submodule update --init --recursive --quiet

TAG=$(git rev-parse --short HEAD)
docker build --quiet -t "riftden-web:$TAG" -t riftden-web:latest --build-arg SITE_URL=https://riftden.com .

docker compose -f deploy/compose.yml up -d --remove-orphans
# старые сборки сайта — только свои образы, на сервере живут и другие проекты
docker images riftden-web --format '{{.Tag}}' | grep -vxE "latest|$TAG" | xargs -r -I{} docker rmi -f "riftden-web:{}" >/dev/null

echo "riftden.com: выложен $TAG"
