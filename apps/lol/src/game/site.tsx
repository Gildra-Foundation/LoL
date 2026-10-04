// Всё, чем сайт LoL отличается от сайта другой игры на том же движке: название, знак, меню, подвал, поиск — на каждом языке.
import type { NavItem, NavLink } from '@rift/engine/layout/Header';
import type { SearchEntry } from '@rift/engine/layout/SearchPalette';
import { PATCH } from '@/lib/assets';
import { defineMessages, type Locale } from '@/lib/i18n';

export const SITE_NAME = 'Rift Codex';

/** Знак — клавиша R: в игре на ней висит абсолютное умение. */
export const SITE_MARK = (
  <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
    <rect x="1" y="2" width="30" height="29" rx="6" fill="#0b100e" />
    <rect x="1.5" y="1.5" width="29" height="25" rx="5.5" fill="#26302c" stroke="#4a5852" />
    <path d="M11 20V8h6a3.6 3.6 0 0 1 0 7.2h-6M16.4 15.2 21 20" fill="none" stroke="#e9e4d6" strokeWidth="2.6" strokeLinecap="square" />
  </svg>
);

const TEXT = defineMessages({
  ru: {
    title: 'Rift Codex — чемпионы League of Legends',
    description:
      'Характеристики всех чемпионов League of Legends на каждом уровне, умения с перезарядкой и видео, предметы, руны и билды, карта Рунтерры, тир-лист и сравнение.',
    champions: 'Чемпионы',
    runeterra: 'Рунтерра',
    items: 'Предметы',
    builds: 'Билды',
    buildEditor: 'Конструктор билдов',
    tierList: 'Тир-лист',
    stats: 'Рейтинги',
    tools: 'Инструменты',
    compare: 'Сравнение',
    duel: 'Дуэль',
    guess: 'Угадай чемпиона',
    articles: 'Статьи',
    searchLabel: 'Найти чемпиона',
    badge: `Патч ${PATCH}`,
    mobileBadge: `Данные патча ${PATCH}`,
    sections: {
      champions: ['Все чемпионы', 'Каталог с фильтрами по классу и позиции'],
      runeterra: ['Рунтерра', 'Карта мира: регионы, их история и чемпионы'],
      items: ['Предметы', 'Цены, характеристики, рецепты и улучшения'],
      builds: ['Конструктор билдов', 'Руны, заклинания и предметы с расчётом характеристик'],
      stats: ['Рейтинги', 'Таблица характеристик на любом уровне'],
      compare: ['Сравнение', 'Два чемпиона на одной шкале'],
      articles: ['Статьи', 'Механики, макро-игра, советы новичкам'],
    },
    placeholder: 'Чемпион, предмет или регион',
    emptyHint: 'Проверьте написание или поищите по классу.',
    loading: 'Загружаю список чемпионов…',
    about: (count: number, version: string, date: string) =>
      `${SITE_NAME} — справочник по чемпионам League of Legends. ${count} чемпионов, данные патча ${version}, обновлены ${date}.`,
    data: 'Данные',
    media: 'Изображения и видео загружаются с серверов Riot.',
  },
  en: {
    title: 'Rift Codex — League of Legends champions',
    description:
      'Stats of every League of Legends champion at every level, abilities with cooldowns and videos, items, runes and builds, the map of Runeterra, a tier list and comparisons.',
    champions: 'Champions',
    runeterra: 'Runeterra',
    items: 'Items',
    builds: 'Builds',
    buildEditor: 'Build editor',
    tierList: 'Tier list',
    stats: 'Rankings',
    tools: 'Tools',
    compare: 'Compare',
    duel: 'Duel',
    guess: 'Guess the champion',
    articles: 'Articles',
    searchLabel: 'Find a champion',
    badge: `Patch ${PATCH}`,
    mobileBadge: `Patch ${PATCH} data`,
    sections: {
      champions: ['All champions', 'Catalog with class and position filters'],
      runeterra: ['Runeterra', 'World map: regions, their history and champions'],
      items: ['Items', 'Prices, stats, recipes and upgrades'],
      builds: ['Build editor', 'Runes, spells and items with stat calculations'],
      stats: ['Rankings', 'Stat table at any level'],
      compare: ['Compare', 'Two champions on one scale'],
      articles: ['Articles', 'Mechanics, macro, tips for beginners'],
    },
    placeholder: 'Champion, item or region',
    emptyHint: 'Check the spelling or search by class.',
    loading: 'Loading the champion list…',
    about: (count: number, version: string, date: string) =>
      `${SITE_NAME} is a League of Legends champion reference. ${count} champions, patch ${version} data, updated ${date}.`,
    data: 'Data',
    media: 'Images and videos are loaded from Riot servers.',
  },
});

/** Меню, поиск и подвал на языке страницы. withArticles — показывать ли раздел статей (пока статей нет, он скрыт). */
export function getSite(lang: Locale, { withArticles }: { withArticles: boolean }) {
  const t = TEXT[lang];
  const articles = withArticles ? [{ href: '/articles', label: t.articles }] : [];

  const nav: NavItem[] = [
    { href: '/champions', label: t.champions },
    { href: '/runeterra', label: t.runeterra },
    { href: '/items', label: t.items },
    { href: '/builds', label: t.builds },
    { href: '/tier-list', label: t.tierList },
    { href: '/stats', label: t.stats },
    {
      label: t.tools,
      children: [
        { href: '/compare', label: t.compare },
        { href: '/duel', label: t.duel },
        { href: '/guess', label: t.guess },
      ],
    },
    ...articles,
  ];

  const section = (href: string, [title, sub]: string[]): SearchEntry => ({ href, title, sub });
  const searchSections: SearchEntry[] = [
    section('/champions', t.sections.champions),
    section('/runeterra', t.sections.runeterra),
    section('/items', t.sections.items),
    section('/builds', t.sections.builds),
    section('/stats', t.sections.stats),
    section('/compare', t.sections.compare),
    ...(withArticles ? [section('/articles', t.sections.articles)] : []),
  ];

  const footerLinks: NavLink[] = [
    { href: '/champions', label: t.champions },
    { href: '/runeterra', label: t.runeterra },
    { href: '/items', label: t.items },
    { href: '/builds', label: t.buildEditor },
    { href: '/tier-list', label: t.tierList },
    { href: '/stats', label: t.stats },
    { href: '/compare', label: t.compare },
    { href: '/duel', label: t.duel },
    { href: '/guess', label: t.guess },
    ...articles,
  ];

  const sources = (
    <>
      {t.data}:{' '}
      <a href="https://developer.riotgames.com/docs/lol#data-dragon" target="_blank" rel="noopener">
        Data Dragon
      </a>
      ,{' '}
      <a href="https://www.communitydragon.org/" target="_blank" rel="noopener">
        CommunityDragon
      </a>
      ,{' '}
      <a href="https://github.com/meraki-analytics/lolstaticdata" target="_blank" rel="noopener">
        Meraki Analytics
      </a>
      ,{' '}
      <a href="https://universe.leagueoflegends.com/" target="_blank" rel="noopener">
        Universe
      </a>
      . {t.media}
    </>
  );

  return {
    title: t.title,
    description: t.description,
    nav,
    header: { searchLabel: t.searchLabel, badge: t.badge, mobileBadge: t.mobileBadge },
    searchSections,
    search: { placeholder: t.placeholder, emptyHint: t.emptyHint, loadingText: t.loading },
    footerLinks,
    sources,
    about: t.about,
    legal: lang === 'ru' ? [LEGAL_RU, LEGAL_EN] : [LEGAL_EN],
  };
}

/** Оговорка Riot для фан-сайтов (Legal Jibber Jabber): английский текст обязателен на всех языках. */
const LEGAL_RU = (
  <p key="ru">
    Rift Codex не одобрен Riot Games и не отражает взгляды или мнения Riot Games или кого-либо, официально участвующего в создании или управлении проектами
    Riot Games. Riot Games и все связанные проекты — товарные знаки или зарегистрированные товарные знаки Riot Games, Inc.
  </p>
);
const LEGAL_EN = (
  <p key="en" lang="en">
    Rift Codex isn&apos;t endorsed by Riot Games and doesn&apos;t reflect the views or opinions of Riot Games or anyone officially involved in producing or
    managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.
  </p>
);
