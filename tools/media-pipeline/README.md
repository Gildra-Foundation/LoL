# RiftDen media pipeline

Офлайн-конвейер медиа скинов League of Legends для riftden.com: 3D-модели (glb со
скелетом и анимациями), озвучка en/ru (opus), сплеши, загрузочные экраны, тайлы,
хромы и ролики. Работает на сервере в Docker-образе `riftden-media`, пишет в
`/opt/riftden/media/<patch>/`, сайт отдаёт это через `riftden-nginx` как `/media/…`.

## Откуда данные

| Что | Источник |
|---|---|
| WAD чемпиона и локалей `en_US`, `ru_RU` | патч-серверы Riot: версия live из `sieve.services.riotcdn.net` (EUW1), манифест `.rman`, только нужные чанки по HTTP Range (`pipeline/rman_fetch.py`) |
| Модель: `.skn/.skl/.anm/.tex` | WAD → свой конвертер `riftmodel` (C#, LeagueToolkit 4.1.0-beta.53) → glb → `node/optimize.mjs` (gltf-transform 4.5.1: meshopt, WebP-текстуры ≤1024 px) |
| Выбор файлов скина | BIN скина (CDTB): `skinMeshProperties` (меш, скелет, текстуры, `materialOverride`, `initialSubmeshToHide`), граф анимаций `mClipDataMap` |
| Озвучка | `…/vo/en_us/…/skinNN_vo_audio.wpk` + `_vo_events.bnk` из `<Champ>.en_US.wad.client` и `<Champ>.ru_RU.wad.client` (в ru-WAD путь тоже `en_us`, содержимое русское) → `.wem` → vgmstream r2168 → ffmpeg libopus 48 kbit/s |
| Подписи реплик | имена событий из BIN скина (`skinAudioProperties.bankUnits[*_VO].events`), FNV-1 → HIRC events.bnk (Event → Action Play → Sound/контейнеры) |
| Картинки и ролики | CommunityDragon `<patch>/…/v1/skins.json` (User-Agent обязателен) → `cwebp -q 82`, `avifenc` (сплеши), webm — копия |

Пути BIN типа `PATH` — это xxh64 пути, т. е. сразу хэш записи WAD, поэтому
таблица путей CDragon (233 МБ) не нужна. Для нечётких имён клипов анимаций
скачивается только `hashes.binhashes.txt` (28 МБ, кэш на сутки).

## Результат

```
/opt/riftden/media/
  current.json               ← {"patch":"16.21","base":"/media/16.21/"}: последний полностью готовый патч (пишется последним, атомарно)
  SITE_PATCH                 ← пишет выкатка сайта: патч, который сайт сейчас использует
  16.21/
    manifest.json            ← все скины (для update-data)
    skins/<skinId>.json      ← запись одного скина = manifest.skins[<skinId>] (для страницы скина)
    report.json              ← время, счётчики, размеры, список провалов
    images/{splash,uncentered}/<skinId>.webp + .avif
    images/{tile,loading,vintage}/<skinId>.webp
    images/chromas/<chromaId>.webp
    video/splash/<skinId>.webm, video/features/<skinId>-<n>.webm
    models/<skinId>.glb, models/chromas/<chromaId>[-<hash>].webp
    vo/{en,ru}/<skinId>/<wemId>.ogg
  16.21.partial/             ← идёт сборка (не отдавать)
```

Формат `manifest.json` (все пути относительно `/media/<patch>/`):

```json
{ "patch": "16.21", "generatedAt": "2026-11-01T20:00:00Z", "skins": { "103014": {
  "images": { "splash": "images/splash/103014.webp", "uncentered": "…", "tile": "…", "loading": "…", "vintage": "…" },
  "chromas": { "103059": { "image": "images/chromas/103059.webp", "texture": "models/chromas/103059.webp" } },
  "video": { "splash": "video/splash/103014.webm", "features": [{ "name": "Double Strike", "file": "video/features/…webm" }] },
  "model": { "glb": "models/103014.glb", "animations": ["idle", "run", "attack", "spell1", "…"], "bytes": 3766404 },
  "vo": { "en": [{ "file": "vo/en/103014/842346530.ogg", "event": "AhriBasicAttack2_cast3D", "duration": 0.74 }], "ru": […] },
  "voFrom": 103000 } } }
```

- `images.splash`/`images.uncentered`: рядом лежит `.avif` с тем же именем.
- `vintage`, `video.splash`, `model`, `vo`, `voFrom`, `chromas[*].texture` — только если есть.
- Ключи `skins` — все 2173 скина `skins.json` и ступени tiered-скинов (`questSkinInfo.tiers`, отдельные id).
- Анимации (имена в glb и в `animations`): `idle, run, attack, spell1–4, dance, recall, joke, taunt` — какие нашлись в графе скина; одинаковые файлы не дублируются.
- `vo.<lang>[].event` — имя события без префикса `Play_vo_<Скин>_` (`Attack2DGeneral`, `Joke3DGeneral`, `Kill3DPenta`, `Move2DStandard`…); реплики без события — в конце списка без `event`.
- `voFrom` — у скина нет своей озвучки: брать `vo` у указанного скина (обычно базового; у хром/ступеней — родительского).

### Хромы в 3D

В корне glTF лежит `extras.riftden` (в three.js — `gltf.userData.riftden`):

```json
{ "baseMaterials": ["Body"], "chromas": { "103059": { "Body": "models/chromas/103059.webp", "Tails": "models/chromas/103059-1a2b….webp" } } }
```

Для хромы заменить `map` у материалов из `chromas[id]` (пути относительно `/media/<patch>/`).
`manifest.chromas[id].texture` — основная текстура хромы (для простого случая).
Текстуры glb и хром — WebP с флагом `flipY = false`, как у glTF.

### Просмотрщик (three.js)

`GLTFLoader` + `setMeshoptDecoder(MeshoptDecoder)` (`three/addons/libs/meshopt_decoder.module.js`).
Материалы `KHR_materials_unlit` с `alphaMode: MASK` (освещение LoL нарисовано в текстурах).
Масштаб — игровые единицы (рост ~150–280), центрировать по `Box3`. Проверочный рендер: `qa/render.mjs`.

## Запуск

```bash
docker build -t riftden-media:$(git rev-parse --short HEAD) tools/media-pipeline
docker tag riftden-media:$(git rev-parse --short HEAD) riftden-media:current
```

Полная сборка патча (возобновляемая: готовые чемпионы и картинки пропускаются):

```bash
sudo docker run --rm --cpus 4 --memory 8g -u 1000:1000 -v /opt/riftden/media:/out -v /var/cache/riftden-media:/cache riftden-media:current build --workers 3
```

Частичная (в `<patch>.partial`, для проверки): `… build --skins 103014,103000` или `--champions Ahri,Zed`.

Ежедневно: `systemd/riftden-media.timer` (05:30 UTC ± 30 мин) → `riftden-media.service` →
`run.py update`: версия CDragon `content-metadata.json` и live-версия Riot совпадают и
`/opt/riftden/media/<patch>/manifest.json` ещё нет → сборка в `<patch>.partial`, затем
переименование в `<patch>`. Перед сборкой нужно ≥ 20 ГБ свободного места. Если версии
расходятся — ждём следующего дня.

Удаление старых патчей: только папки **старше** патча из `/opt/riftden/media/SITE_PATCH`.
Этот файл должна писать выкатка сайта после переключения на новый патч
(`echo 16.22 > /opt/riftden/media/SITE_PATCH`). Нет файла — ничего не удаляется.

Установка юнитов:

```bash
sudo install -m 644 tools/media-pipeline/systemd/riftden-media.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now riftden-media.timer
```

## Встраивание в deploy (делает основная сессия)

`deploy/compose.yml`, сервис `nginx`, в `volumes`:

```yaml
      # медиа скинов (tools/media-pipeline): /opt/riftden/media/<patch>/…
      - /opt/riftden/media:/srv/media:ro
```

`deploy/nginx.conf`, внутри `server { server_name riftden.com; … }`:

```nginx
  # Медиа скинов: файлы внутри /media/<patch>/ не меняются, новый патч — новый путь.
  location /media/ {
    alias /srv/media/;
    add_header Cache-Control "public, max-age=31536000, immutable" always;
    add_header X-Content-Type-Options nosniff always;
    types {
      model/gltf-binary glb;
      image/webp webp;
      image/avif avif;
      audio/ogg ogg;
      video/webm webm;
      application/json json;
    }
    default_type application/octet-stream;
    gzip_types application/json model/gltf-binary;
  }
  # служебное и недостроенное не отдавать
  location ~ ^/media/(.*/)?(\.[^/]*|[^/]+\.partial(/.*)?|report\.json|SITE_PATCH)$ {
    return 404;
  }
```

CORS не нужен (тот же домен). Cloudflare по умолчанию не кэширует `glb/ogg`:
при желании — Cache Rule «`/media/*` → Eligible for cache, Edge TTL: respect origin».

## Проверка

- `report.json`: `counts` (скинов, с glb, с озвучкой en/ru, voFrom), `bytes`, `timings`, `failures[]` (`stage`: images/model/animations/vo-en/vo-ru/champion, `reason`).
- Глазами: `cd qa && npm ci && node render.mjs /tmp/shots /opt/riftden/media/16.21/models/103014.glb@dance` (в образе `mcr.microsoft.com/playwright:v1.64.0-noble`).

## Известные ограничения

- 41 скин режима «Jade_*» (id 60001xxx…) не имеет WAD в клиенте игры → только картинки.
- Подписи — имена событий Wwise; реплики, которые не достижимы из событий, идут без `event`.
- ImageSharp 3.1.12 (зависимость LeagueToolkit) имеет известные уязвимости декодеров; на вход идут только файлы игры и наши PNG, конвертер работает в контейнере без сети к сайту.
- Ассеты — собственность Riot Games («Legal Jibber Jabber»); на сайте нужна атрибуция CommunityDragon.
