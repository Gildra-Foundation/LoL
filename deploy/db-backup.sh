#!/usr/bin/env bash
# Резервная копия базы аккаунтов RiftDen: pg_dump в формате custom из контейнера riftden-db,
# проверка архива (pg_restore --list) и хранение последних 14 копий. Запуск — riftden-db-backup.timer раз в сутки.
# Восстановление: docker exec -i riftden-db pg_restore -U riftden -d riftden --clean --if-exists < <файл>
set -euo pipefail
DIR=${RIFTDEN_DB_BACKUP_DIR:-/opt/riftden/backups/db}
KEEP=${RIFTDEN_DB_BACKUP_KEEP:-14}
CONTAINER=${RIFTDEN_DB_CONTAINER:-riftden-db}
umask 077
mkdir -p "$DIR"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
TARGET="$DIR/riftden-$STAMP.dump"
PARTIAL="$TARGET.partial"
trap 'rm -f "$PARTIAL"' EXIT
docker exec "$CONTAINER" pg_dump -U riftden -d riftden --format=custom --compress=6 > "$PARTIAL"
# пустой или битый архив не заменяет хорошие копии
docker exec -i "$CONTAINER" pg_restore --list > /dev/null < "$PARTIAL"
mv "$PARTIAL" "$TARGET"
# старые копии — только после успешной новой
ls -1t "$DIR"/riftden-*.dump | tail -n +"$((KEEP + 1))" | xargs -r rm -f --
echo "RiftDen DB backup: $TARGET ($(stat -c %s "$TARGET") bytes), kept $(ls -1 "$DIR"/riftden-*.dump | wc -l)"
