# Аккаунты и избранное

Вход по почте и паролю (Better Auth 1.7), обязательное подтверждение почты, сброс и смена пароля, выход, удаление аккаунта. Избранное — только для вошедших.

## Код

- `apps/lol/src/lib/account/` — сервер: `auth.ts` (настройки Better Auth, лимиты), `migrations.ts` (схема и раннер), `favorites.ts` (API избранного без Next — проверяется тестами), `mail.ts` + `mail-templates.ts` (письма ru/en), `config.ts` (окружение); для браузера — `client.ts`, `messages.ts`, `shared.ts`.
- `apps/lol/src/app/api/auth/[...all]` — Better Auth; `api/favorites` — GET/POST/DELETE `{kind, ref}`; `api/account-config` — включены ли аккаунты и ключ Turnstile.
- `apps/lol/src/instrumentation.ts` — при запуске сервера применяет миграции (advisory-lock, каждая в транзакции, таблица `riftden_migration`) и раз в час удаляет просроченные сессии, токены и счётчики лимитов.
- Клиент: `components/account/AccountProvider.tsx` (сессия и избранное, окно входа), `AccountMenu.tsx` (слот `actions` шапки движка), страницы `/account`, `/account/verify`, `/account/reset`, `/account/settings`, `/favorites`, `/privacy`.
- Кнопка избранного: `components/favorites/FavoriteButton.tsx`, пропсы `{kind: 'skin'|'skinline'|'universe'|'champion', id, compact?}`. Проп называется `id`, а не `ref`: `ref` React не передаёт клиентскому компоненту из серверной страницы («Refs cannot be used in Server Components»). Гостю кнопка открывает окно входа и добавляет объект после входа; без настроенной базы кнопки нет.
- `/favorites` берёт названия и картинки образов из `/[lang]/skins-index.json` (`{id, slug, name, champion, tile, rarity}`); пока файла нет — показывает id.

Письма ведут на страницы сайта (`/account/verify?token=…`, `/account/reset?token=…`), токен тратится нажатием кнопки — почтовые сканеры, открывающие ссылки заранее, ничего не подтверждают. Язык письма — по странице, с которой пришёл запрос.

## Окружение

| Переменная | Где | Зачем |
| --- | --- | --- |
| `DATABASE_URL`, `BETTER_AUTH_SECRET` | `/opt/riftden/riftden.env` | без них `/api/auth*` и `/api/favorites` отвечают 503, меню аккаунта скрыто |
| `POSTGRES_PASSWORD` | `/opt/riftden/riftden.env` | пароль сервиса `db` (тот же, что в `DATABASE_URL`) |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | `/opt/riftden/riftden.env` | Cloudflare Turnstile на регистрации, запросе сброса и повторном письме; нет ключей — нет проверки |
| `SMTP_HOST/PORT/USER/PASS`, `SMTP_TLS_SERVERNAME`, `EMAIL_FROM_ADDRESS/NAME` | `/opt/riftden/mail.env` | отправка через Postfix хоста (`host.docker.internal:587`, STARTTLS + SASL) |
| `BETTER_AUTH_URL`, `EMAIL_TRANSPORT=smtp` | `deploy/compose.yml` | адрес для ссылок, cookie `Secure` и проверки Origin |
| `EMAIL_TRANSPORT=capture`, `EMAIL_CAPTURE_DIR` | staging, e2e | письма — в память и JSON-файлы; на `https://riftden.com` capture не включается |
| `AUTH_RATE_LIMIT=off` | только локально | выключает лимиты Better Auth |

Cookie сессии: `__Secure-riftden.session_token`, httpOnly, Secure, SameSite=Lax, 30 дней. Лимиты по адресу (`cf-connecting-ip`) хранятся в таблице `rateLimit`: регистрация 5/10 мин, вход 5/мин, сброс и повторное письмо 3/10 мин, остальное 100/мин. `/api/favorites`: 300/мин на адрес, 120 чтений и 60 изменений в минуту на аккаунт, до 2000 объектов.

## Сервер

- База: сервис `db` (`postgres:17-alpine`, контейнер `riftden-db`), том `/opt/riftden/db`, только внутренняя сеть. `deploy/release.sh` поднимает его (`up -d --wait db`) перед переключением сайта; откат сайта базу не трогает (миграции только добавляют).
- Резервные копии: `deploy/db-backup.sh` (pg_dump custom → проверка pg_restore --list → хранит 14 в `/opt/riftden/backups/db`). Включить: `sudo cp deploy/riftden-db-backup.{service,timer} /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl enable --now riftden-db-backup.timer`.
- Восстановление: `docker exec -i riftden-db pg_restore -U riftden -d riftden --clean --if-exists < /opt/riftden/backups/db/<файл>.dump`.

## Проверки

- `npm test` — шаблоны писем, режимы почты, лимитер, API избранного; с `TEST_DATABASE_URL=postgres://…/<имя>_test` (база очищается) — ещё полный цикл Better Auth на Postgres: миграции, регистрация, подтверждение, вход, лимит 429, сброс и смена пароля, удаление с избранным, Origin.
- `E2E_DATABASE_URL=postgres://…/riftden_e2e npm run test:e2e` — сервер на 3015 с базой и письмами в `artifacts/e2e-mail`: регистрация → письмо → подтверждение → вход → избранное → `/favorites`; сброс пароля и удаление аккаунта; noindex и axe. Против staging: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3016 E2E_EMAIL_DIR=artifacts/staging-mail`.
