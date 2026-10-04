# Новая игра на движке

Репозиторий устроен так: общий движок `packages/engine` (`@rift/engine`) и сайты игр в `apps/`. Сайт League of Legends `apps/lol` — рабочий пример. Новая игра — ещё одна папка в `apps/` со своим Next.js-приложением, которое берёт общее из движка.

Ниже — что даёт движок, что должна дать игра и пошаговый план на примере Genshin Impact.

## Что даёт движок

| Модуль | Импорт | Что передаёт игра |
|---|---|---|
| Базовые стили | `@rift/engine/styles/base.css` | Тему с цветами и шрифтами (см. «Контракт темы») |
| Интерфейс | `@rift/engine/ui/…`: `Button`, `Frame`, `Keycap`, `PageHead`, `Radar`, `ResourceBar`, `Tag`, `LevelControl`, `EntityPicker`, `Icon` | `LevelControl max` (у LoL 18), `EntityPicker iconUrl`, значок для `Tag icon` |
| Иконки | `createIcon` из `@rift/engine/ui/Icon` | Свои иконки: классы, стихии, характеристики |
| Шапка, подвал, поиск | `@rift/engine/layout/Header`, `Footer`, `SearchPalette` | Название, знак, меню (пункты и выпадающие группы `{ label, children }`), тексты подвала, разделы поиска, индекс поиска |
| Статьи | `createArticleStore` из `@rift/engine/articles/store`; `ArticleCard`, `ArticleList`, `TableOfContents`; `@rift/engine/mdx/MdxContent` | Папку статей, категории, адрес обложки, свои поля frontmatter, MDX-компоненты |
| Тир-лист | `@rift/engine/tierlist/TierList`, `TierPreview`, `model` | Участников, группы (у LoL — линии), адреса иконок и страниц, ключ хранилища, тексты |
| Угадайка | `@rift/engine/guess/GuessGame`, `model` | Участников, колонки признаков, адреса иконок и артов, день загадки №1, тексты |
| Форматирование | `@rift/engine/lib/format` (`fmt`, `plural`, `formatDate`), `@rift/engine/lib/scale` | — |

Всё остальное у каждой игры своё: данные, формулы, страница героя, главная, особые инструменты (у LoL — HUD чемпиона и дуэль).

## Контракт темы

Тема игры — файл `src/styles/theme.css`, подключается в `layout.tsx` после `base.css`. Обязательные токены:

| Токен | Смысл |
|---|---|
| `--night`, `--night-2` | фон страницы и приподнятых поверхностей |
| `--stone`, `--stone-2` | панели и панели при наведении |
| `--line`, `--line-2` | границы и выделенные границы |
| `--bone`, `--ash`, `--ash-2` | основной, второстепенный и третичный текст |
| `--ally` | акцент: выбор, ссылки, «своя» сторона |
| `--health`, `--enemy` | хорошо и плохо: рост и потери, совпало и мимо |
| `--gold` | первое место и тир S |
| `--warn` | «частично» в угадайке |
| `--font-display`, `--font-text` | шрифт заголовков и чисел, шрифт текста |

Необязательные токены тёмных деталей движка. Без них остаются цвета LoL, поэтому тема с другим оттенком ночи задаёт их сама:

| Токен | Где |
|---|---|
| `--well` | углублённые поверхности: подвал, поле поиска, поля, дорожки полос, карточки статей |
| `--abyss` | самый тёмный край: нижние грани клавиш тиров, рамка полос |
| `--key-top`, `--key-bottom` | градиент клавиш (`Keycap`, `LevelControl`) |
| `--panel-ally`, `--panel-enemy` | панели с оттенком своей и чужой стороны (`Frame`, тир-лист, угадайка) |
| `--plate` | подложка в списке статей |
| `--ally-soft` | светлый акцент: фокус ползунка уровня |
| `--button-cut`, `--button-cut-sm`, `--button-radius` | форма кнопок: срез углов (по умолчанию 8 и 6 px) или скругление |


Названия токенов пришли из HUD League of Legends, но смысл у них общий. Тема может переопределить сетку, размеры и движение: `--container`, `--header-h`, `--chamfer`, `--radius-key`, `--fs-*`, `--ease`, `--t-*`.

## Пошагово: Genshin Impact

### 1. Каркас приложения

Создайте `apps/genshin` по образцу `apps/lol`:

- `package.json` — имя `@rift/genshin`, зависимость `"@rift/engine": "*"`;
- `next.config.ts` — с `transpilePackages: ['@rift/engine']`;
- `tsconfig.json` — как в LoL: `extends: "../../tsconfig.base.json"` и `paths` `@/*`;
- `src/app/[lang]/layout.tsx` — корневой макет на каждом языке: шрифты через `next/font`, `base.css` и своя тема, `LocaleProvider`, `Header`, `Footer` и `SearchPalette` из движка; `generateStaticParams` — все языки;
- `src/proxy.ts` — как в LoL: адреса основного языка без префикса;
- `src/game/site.tsx` — название, знак, меню, тексты подвала на каждом языке. В подвал добавьте оговорку HoYoverse для фан-сайтов: правила для фанатского контента нужно прочитать на их сайте;
- `public/` — favicon.

В корневой `package.json` добавьте команды `dev:genshin` и `build:genshin` по образцу `dev` и `build`: `npm run dev -w @rift/genshin`.

### 2. Данные

У Genshin нет официального источника вроде Data Dragon. Подойдут общественные базы, например npm-пакет `genshin-db` с русским переводом или API Project Amber. Перед выбором проверьте условия использования и откуда берутся картинки.

- `scripts/fetch-data.mjs` — скачивает данные и пишет `src/data/characters.json` и `meta.json` с версией игры;
- `src/lib/characters.ts` (`import 'server-only'`) — доступ к данным, как `apps/lol/src/lib/champions.ts`;
- `src/lib/assets.ts` — адреса иконок, артов и карточек, как `apps/lol/src/lib/assets.ts`;
- `src/lib/labels.ts` — стихии (Пиро, Гидро, Анемо, Электро, Дендро, Крио, Гео), оружие (одноручный меч, двуручный меч, древковое, лук, катализатор), регионы, редкость;
- формулы характеристик: уровни 1–90 с возвышением. В `LevelControl` передайте `max={90}`: при таком максимуме полоса делений не рисуется, остаются кнопки и ползунок.

### 3. Тема и иконки

- `src/styles/theme.css` — токены из контракта со своей палитрой: Genshin светлее и мягче HUD;
- `src/components/Icon.tsx` — `export const Icon = createIcon({ Pyro: '…', Hydro: '…' })`, по образцу `apps/lol/src/components/Icon.tsx`. Сетка 24×24, обводка 1.75.

### 4. Тир-лист

Группы — стихии, у каждой свой тир-лист:

```ts
// src/lib/tierlist.ts
export const ELEMENT_GROUPS: TierGroup[] = [
  { key: 'all', param: 'all', label: 'Все', title: 'Все персонажи', all: true },
  { key: 'Pyro', param: 'pyro', label: 'Пиро', title: 'Пиро' },
  // …
];
```

Участники — `{ id, slug, name, groups: [element] }`. Компоненту нужны функции (`iconUrl`, `itemHref`), а функции нельзя передать из серверной страницы в клиентский компонент. Поэтому сделайте клиентскую обёртку, как `apps/lol/src/components/tierlist/LolTierList.tsx`: `storageKey="gi:tier-list"`, `groupParam="element"`, тексты про персонажей.

### 5. Угадайка

Колонки собираются из готовых сравнений:

```ts
export const GUESS_COLUMNS: GuessColumn<GuessCharacter>[] = [
  { label: 'Стихия', value: (c) => ELEMENTS[c.element], judge: sameValue((c) => c.element) },
  { label: 'Оружие', value: (c) => WEAPONS[c.weapon], judge: sameValue((c) => c.weapon) },
  { label: 'Регион', value: (c) => c.region, judge: sameValue((c) => c.region) },
  { label: 'Редкость', value: (c) => `${c.rarity}★`, judge: ordered((c) => c.rarity) },
  { label: 'Версия', value: (c) => c.version, judge: ordered((c) => c.versionNumber) },
];
```

Обёртка — как `apps/lol/src/components/guess/LolGuessGame.tsx`. У каждого участника есть `answerable`: может ли он быть загадкой дня. Например, `false`, если у персонажа неизвестна версия выхода.

### 6. Статьи и поиск

- `src/lib/articles.ts` — `createArticleStore({ dir, categories, defaultAuthor, coverUrl, extend })`, по образцу LoL;
- `src/components/mdx/components.tsx` — свои MDX-компоненты, их получает `MdxContent`;
- `src/app/[lang]/search-index.json/route.ts` — индекс в формате `SearchIndex` на каждом языке: группы «Персонажи» и «Статьи». Адреса в индексе — без префикса языка, его добавит поиск.

### 7. Страницы игры

Главная, страница персонажа, каталог, сравнение и рейтинги — своими компонентами из деталей движка: `ResourceBar` для HP/АТК/ЗАЩ, `LevelControl`, `Radar`, `Frame`, `Tag`. Движок не навязывает, как выглядит страница героя.

### 8. Публикация

Отдельный проект на Vercel с Root Directory `apps/genshin`. Сайт LoL при этом не меняется.

## Правила движка

- **Движок ничего не знает об игре.** Всё игровое приходит параметрами: тексты, иконки, адреса, группы, колонки.
- **Внутри движка только относительные импорты** (`../ui/Button`). Алиас `@/` указывает на приложение и внутри движка сломается.
- **Тексты с героем** («чемпион», «персонаж») передаются через `texts`. По умолчанию стоят нейтральные слова.
- **Языки.** Строки компонентов движка — в `defineMessages({ ru, en })` рядом с компонентом; язык страницы клиентские компоненты берут из `LocaleProvider` (`useLocale`, `useMessages`), серверные — параметром `locale`. Ссылки — через `i18n/Link`: он сам ставит префикс языка. Числа и даты — `fmt`, `plural`, `formatDate` с языком.
- **Функции не передаются из серверной страницы в клиентский компонент.** Для этого есть клиентские обёртки игры.
- **Проверка перед публикацией:** `npm run check` (движок и сайт) и `npm run build`.

## Чек-лист новой игры

- [ ] `npm run check` и `npm run build` проходят;
- [ ] тема задаёт все обязательные токены;
- [ ] поиск находит героев и статьи, индекс отдаётся по `/search-index.json`;
- [ ] тир-лист: группы переключаются, расстановка сохраняется, ссылка открывает её для просмотра;
- [ ] угадайка: загадка дня одна у всех, колонки сравниваются правильно, «Поделиться» копирует строку;
- [ ] в подвале есть источники данных и оговорка правообладателя;
- [ ] каждая страница открывается на всех языках, переключатель в шапке ведёт на ту же страницу.
