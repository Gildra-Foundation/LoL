// Предметы: типы, разделы магазина, характеристики. Данные — src/data/<язык>/items.json (scripts/fetch-items.mjs).
// Модуль без данных — его можно импортировать и в клиентские компоненты.
import { LOCALES, defineMessages, type Locale } from '@rift/engine/i18n/locale';
import { fmt } from '@rift/engine/lib/format';

export type ItemCategory = 'starter' | 'boots' | 'basic' | 'epic' | 'legendary' | 'consumable';

export type ItemStat =
  | 'hp'
  | 'ad'
  | 'ap'
  | 'armor'
  | 'mr'
  | 'as'
  | 'crit'
  | 'critDamage'
  | 'ms'
  | 'msPct'
  | 'haste'
  | 'lethality'
  | 'armorPenPct'
  | 'magicPen'
  | 'magicPenPct'
  | 'lifesteal'
  | 'omnivamp'
  | 'mana'
  | 'manaRegen'
  | 'hpRegen'
  | 'healShield'
  | 'tenacity'
  | 'goldPer10';

export interface Item {
  id: string;
  name: string;
  plaintext: string;
  category: ItemCategory;
  gold: { total: number; base: number; sell: number };
  stats: Partial<Record<ItemStat, number>>;
  tags: string[];
  from: string[];
  into: string[];
  /** пассивные и активные эффекты, безопасный HTML из скрипта загрузки */
  html: string;
}

/** Разделы в порядке магазина. */
export const CATEGORIES = defineMessages<{ key: ItemCategory; label: string; hint: string }[]>({
  ru: [
    { key: 'starter', label: 'Стартовые', hint: 'С них начинают игру на линии и в лесу' },
    { key: 'boots', label: 'Сапоги', hint: 'Одни на билд' },
    { key: 'basic', label: 'Базовые', hint: 'Компоненты без рецепта' },
    { key: 'epic', label: 'Эпические', hint: 'Собираются из базовых и улучшаются дальше' },
    { key: 'legendary', label: 'Легендарные', hint: 'Финальные предметы, каждый — в одном экземпляре' },
    { key: 'consumable', label: 'Расходуемые', hint: 'Зелья, эликсиры, тотемы' },
  ],
  en: [
    { key: 'starter', label: 'Starter', hint: 'What you start the game with in lane or jungle' },
    { key: 'boots', label: 'Boots', hint: 'One pair per build' },
    { key: 'basic', label: 'Basic', hint: 'Components without a recipe' },
    { key: 'epic', label: 'Epic', hint: 'Built from basic items and upgraded further' },
    { key: 'legendary', label: 'Legendary', hint: 'Final items, one of each per build' },
    { key: 'consumable', label: 'Consumables', hint: 'Potions, elixirs, wards' },
  ],
});

export const CATEGORY_LABEL = Object.fromEntries(LOCALES.map((l) => [l, Object.fromEntries(CATEGORIES[l].map((c) => [c.key, c.label]))])) as Record<
  Locale,
  Record<ItemCategory, string>
>;

type StatMeta = { icon: string; color: string; percent?: boolean };

const STAT_META: Record<ItemStat, StatMeta> = {
  hp: { icon: 'hp', color: 'var(--stat-hp)' },
  ad: { icon: 'ad', color: 'var(--stat-ad)' },
  ap: { icon: 'ap', color: 'var(--stat-ap)' },
  armor: { icon: 'armor', color: 'var(--stat-armor)' },
  mr: { icon: 'mr', color: 'var(--stat-mr)' },
  as: { icon: 'as', color: 'var(--stat-as)', percent: true },
  crit: { icon: 'crit', color: 'var(--stat-crit)', percent: true },
  critDamage: { icon: 'crit', color: 'var(--stat-crit)', percent: true },
  ms: { icon: 'ms', color: 'var(--stat-ms)' },
  msPct: { icon: 'ms', color: 'var(--stat-ms)', percent: true },
  haste: { icon: 'haste', color: 'var(--stat-haste)' },
  lethality: { icon: 'pen', color: 'var(--stat-pen)' },
  armorPenPct: { icon: 'pen', color: 'var(--stat-pen)', percent: true },
  magicPen: { icon: 'pen', color: 'var(--stat-ap)' },
  magicPenPct: { icon: 'pen', color: 'var(--stat-ap)', percent: true },
  lifesteal: { icon: 'vamp', color: 'var(--stat-vamp)', percent: true },
  omnivamp: { icon: 'vamp', color: 'var(--stat-vamp)', percent: true },
  mana: { icon: 'mp', color: 'var(--stat-mana)' },
  manaRegen: { icon: 'mpregen', color: 'var(--stat-mana)', percent: true },
  hpRegen: { icon: 'hpregen', color: 'var(--stat-hp)', percent: true },
  healShield: { icon: 'hpregen', color: 'var(--stat-hp)', percent: true },
  tenacity: { icon: 'tenacity', color: 'var(--ash)', percent: true },
  goldPer10: { icon: 'gold', color: 'var(--gold)' },
};

const STAT_LABELS = defineMessages<Record<ItemStat, string>>({
  ru: {
    hp: 'Здоровье',
    ad: 'Сила атаки',
    ap: 'Сила умений',
    armor: 'Броня',
    mr: 'Сопротивление магии',
    as: 'Скорость атаки',
    crit: 'Шанс критического удара',
    critDamage: 'Критический урон',
    ms: 'Скорость передвижения',
    msPct: 'Скорость передвижения',
    haste: 'Ускорение умений',
    lethality: 'Смертоносность',
    armorPenPct: 'Пробивание брони',
    magicPen: 'Магическое пробивание',
    magicPenPct: 'Магическое пробивание',
    lifesteal: 'Вампиризм',
    omnivamp: 'Всестороннее вытягивание жизни',
    mana: 'Мана',
    manaRegen: 'Восстановление маны',
    hpRegen: 'Восстановление здоровья',
    healShield: 'Сила лечения и щитов',
    tenacity: 'Стойкость',
    goldPer10: 'Золото за 10 секунд',
  },
  en: {
    hp: 'Health',
    ad: 'Attack damage',
    ap: 'Ability power',
    armor: 'Armor',
    mr: 'Magic resist',
    as: 'Attack speed',
    crit: 'Critical strike chance',
    critDamage: 'Critical strike damage',
    ms: 'Move speed',
    msPct: 'Move speed',
    haste: 'Ability haste',
    lethality: 'Lethality',
    armorPenPct: 'Armor penetration',
    magicPen: 'Magic penetration',
    magicPenPct: 'Magic penetration',
    lifesteal: 'Life steal',
    omnivamp: 'Omnivamp',
    mana: 'Mana',
    manaRegen: 'Base mana regen',
    hpRegen: 'Base health regen',
    healShield: 'Heal and shield power',
    tenacity: 'Tenacity',
    goldPer10: 'Gold per 10 seconds',
  },
});

/** Характеристики предметов с подписями на языке страницы: ITEM_STATS[lang].ad.label. */
export const ITEM_STATS = Object.fromEntries(
  LOCALES.map((l) => [l, Object.fromEntries((Object.keys(STAT_META) as ItemStat[]).map((k) => [k, { ...STAT_META[k], label: STAT_LABELS[l][k] }]))]),
) as Record<Locale, Record<ItemStat, StatMeta & { label: string }>>;

/** Фильтры библиотеки: группы похожих характеристик. */
export const STAT_FILTERS = defineMessages<{ key: string; label: string; stats: ItemStat[] }[]>({
  ru: [
    { key: 'ad', label: 'Сила атаки', stats: ['ad'] },
    { key: 'as', label: 'Скорость атаки', stats: ['as'] },
    { key: 'crit', label: 'Крит', stats: ['crit'] },
    { key: 'pen', label: 'Пробивание', stats: ['lethality', 'armorPenPct', 'magicPen', 'magicPenPct'] },
    { key: 'vamp', label: 'Вампиризм', stats: ['lifesteal', 'omnivamp'] },
    { key: 'ap', label: 'Сила умений', stats: ['ap'] },
    { key: 'mana', label: 'Мана', stats: ['mana', 'manaRegen'] },
    { key: 'haste', label: 'Ускорение', stats: ['haste'] },
    { key: 'hp', label: 'Здоровье', stats: ['hp', 'hpRegen'] },
    { key: 'armor', label: 'Броня', stats: ['armor'] },
    { key: 'mr', label: 'Сопр. магии', stats: ['mr'] },
    { key: 'ms', label: 'Скорость', stats: ['ms', 'msPct'] },
  ],
  en: [
    { key: 'ad', label: 'Attack damage', stats: ['ad'] },
    { key: 'as', label: 'Attack speed', stats: ['as'] },
    { key: 'crit', label: 'Crit', stats: ['crit'] },
    { key: 'pen', label: 'Penetration', stats: ['lethality', 'armorPenPct', 'magicPen', 'magicPenPct'] },
    { key: 'vamp', label: 'Life steal', stats: ['lifesteal', 'omnivamp'] },
    { key: 'ap', label: 'Ability power', stats: ['ap'] },
    { key: 'mana', label: 'Mana', stats: ['mana', 'manaRegen'] },
    { key: 'haste', label: 'Haste', stats: ['haste'] },
    { key: 'hp', label: 'Health', stats: ['hp', 'hpRegen'] },
    { key: 'armor', label: 'Armor', stats: ['armor'] },
    { key: 'mr', label: 'Magic resist', stats: ['mr'] },
    { key: 'ms', label: 'Speed', stats: ['ms', 'msPct'] },
  ],
});

/** «+75», «+25%», «+2,5%» / «+2.5%». */
export const fmtItemStat = (stat: ItemStat, value: number, lang: Locale) =>
  `+${fmt(value, Number.isInteger(value) ? 0 : 1, lang)}${STAT_META[stat].percent ? '%' : ''}`;

/** Цена с разделителем разрядов: «3 500» / «3,500». */
export const fmtGold = (value: number, lang: Locale) => fmt(value, 0, lang);
