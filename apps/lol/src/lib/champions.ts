// Данные о чемпионах и всё, что из них считается при сборке. Только для сервера: модуль тянет весь JSON.
// Числа одинаковы на всех языках — таблицы считаются по основному; названия и тексты — на языке страницы.
import 'server-only';
import en from '../data/en/champions.json';
import meta from '../data/meta.json';
import ru from '../data/ru/champions.json';
import { DEFAULT_LOCALE, LOCALE_TAG, LOCALES, type Locale } from './i18n';
import { CLASS_ORDER, type ClassTag, type Position } from './labels';
import { LEVELS, MAX_LEVEL, RANKED_STATS, statsAtLevel, type BaseStats, type StatKey, type StatValues } from './stats';

export type { ClassTag, Position } from './labels';

export interface Spell {
  key: 'Q' | 'W' | 'E' | 'R';
  id: string;
  name: string;
  description: string;
  maxrank: number;
  cooldown: number[];
  cost: number[];
  costText: string;
  range: number[] | null;
  image: string;
  video: string | null;
}

export interface Skin {
  num: number;
  name: string;
  rarity: string | null;
  legacy: boolean;
  chromas: number;
}

export interface Champion {
  id: string;
  slug: string;
  key: number;
  name: string;
  title: string;
  tags: ClassTag[];
  /** название ресурса на языке страницы: «Мана», «Energy» */
  partype: string;
  /** ресурс ключом для логики и цвета: mana, energy, fury, none… */
  resource: string;
  info: { attack: number; defense: number; magic: number; difficulty: number };
  stats: BaseStats;
  blurb: string;
  lore: string;
  allytips: string[];
  enemytips: string[];
  passive: { name: string; description: string; image: string; video: string | null };
  spells: Spell[];
  skins: Skin[];
  playstyle: { damage: number; durability: number; crowdControl: number; mobility: number; utility: number } | null;
  tactical: { style: number; difficulty: number; damageType: string; attackType: string } | null;
  tagline: string[];
  positions: Position[];
  releaseDate: string | null;
}

const DATA: Record<Locale, Champion[]> = { ru: ru as unknown as Champion[], en: en as unknown as Champion[] };
/** основной набор — по нему считаются таблицы характеристик */
const champions = DATA[DEFAULT_LOCALE];
export const UPDATED_AT = new Date(meta.fetchedAt);
export const CHAMPION_COUNT = champions.length;

/** Все чемпионы на языке страницы, по алфавиту этого языка. */
export const getChampions = (lang: Locale) => DATA[lang];

const byId = Object.fromEntries(LOCALES.map((l) => [l, new Map(DATA[l].map((c) => [c.id, c]))])) as Record<Locale, Map<string, Champion>>;
const bySlug = Object.fromEntries(LOCALES.map((l) => [l, new Map(DATA[l].map((c) => [c.slug, c]))])) as Record<Locale, Map<string, Champion>>;
export const getChampion = (id: string, lang: Locale) => byId[lang].get(id);
export const getChampionBySlug = (slug: string, lang: Locale) => bySlug[lang].get(slug);

export const difficultyLevel = (c: Champion) => c.tactical?.difficulty ?? Math.min(3, Math.max(1, Math.ceil(c.info.difficulty / 3.4)));
export const hasRatings = (c: Champion) => Object.values(c.info).some((v) => v > 0);

/* ───────────── Статистика ───────────── */

// table[level - 1][index] — все характеристики каждого чемпиона на каждом уровне
const table: StatValues[][] = LEVELS.map((level) => champions.map((c) => statsAtLevel(c.stats, level)));
const indexOf = new Map(champions.map((c, i) => [c.id, i]));

export const statsOf = (c: Champion, level: number) => table[level - 1][indexOf.get(c.id)!];

const round = (n: number) => Math.round(n * 1e4) / 1e4;

interface LevelSummary {
  sorted: number[];
  min: number;
  max: number;
  avg: number;
  classAvg: Record<ClassTag, number>;
}

const summaryCache = new Map<string, LevelSummary>();
export function statSummary(key: StatKey, level: number): LevelSummary {
  const cacheKey = `${key}:${level}`;
  const cached = summaryCache.get(cacheKey);
  if (cached) return cached;
  const values = table[level - 1].map((v) => round(v[key]));
  const sorted = values.toSorted((a, b) => b - a);
  const classAvg = {} as Record<ClassTag, number>;
  for (const tag of CLASS_ORDER) {
    const group = values.filter((_, i) => champions[i].tags[0] === tag);
    classAvg[tag] = group.reduce((a, b) => a + b, 0) / (group.length || 1);
  }
  const summary = { sorted, min: sorted[sorted.length - 1], max: sorted[0], avg: values.reduce((a, b) => a + b, 0) / values.length, classAvg };
  summaryCache.set(cacheKey, summary);
  return summary;
}

/** Место чемпиона по характеристике: 1 — наибольшее значение, равные значения делят место. */
export function rankOf(c: Champion, key: StatKey, level: number) {
  const s = statSummary(key, level);
  const value = round(statsOf(c, level)[key]);
  const rank = s.sorted.findIndex((v) => v <= value) + 1;
  return { rank, total: champions.length, value, min: s.min, max: s.max, avg: s.avg, classAvg: s.classAvg[c.tags[0]] };
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;

export interface Series {
  v: number[];
  r: number[];
  min: number[];
  max: number[];
  avg: number[];
}

/** Ряды по уровням 1–18 для клиентского калькулятора. */
export function statSeries(c: Champion): Record<StatKey, Series> {
  const out = {} as Record<StatKey, Series>;
  for (const key of [...RANKED_STATS, 'mp', 'mpregen'] as StatKey[]) {
    const ranked = RANKED_STATS.includes(key);
    const s: Series = { v: [], r: [], min: [], max: [], avg: [] };
    for (const level of LEVELS) {
      s.v.push(r3(statsOf(c, level)[key]));
      if (ranked) {
        const info = rankOf(c, key, level);
        s.r.push(info.rank);
        s.min.push(r3(info.min));
        s.max.push(r3(info.max));
        s.avg.push(r3(info.classAvg));
      }
    }
    out[key] = s;
  }
  return out;
}

export interface LeaderOptions {
  level?: number;
  limit?: number;
  order?: 'asc' | 'desc';
  tag?: ClassTag;
}

/** Рейтинг по характеристике. Ресурс (mp) считается только среди пользователей маны. */
export function leaders(key: StatKey, lang: Locale, { level = 1, limit = 5, order = 'desc', tag }: LeaderOptions = {}) {
  const lvl = Math.min(MAX_LEVEL, Math.max(1, level));
  return DATA[lang]
    .filter((c) => (!tag || c.tags.includes(tag)) && (key !== 'mp' && key !== 'mpregen' ? true : c.resource === 'mana'))
    .map((c) => ({ champion: c, value: statsOf(c, lvl)[key] }))
    .sort((a, b) => (order === 'desc' ? b.value - a.value : a.value - b.value) || a.champion.name.localeCompare(b.champion.name, LOCALE_TAG[lang]))
    .slice(0, limit);
}

/** Похожие чемпионы: близкие базовые характеристики, тот же класс и тип атаки. */
export function similarChampions(c: Champion, lang: Locale, count = 6) {
  const fields: (keyof BaseStats)[] = [
    'hp',
    'hpperlevel',
    'armor',
    'armorperlevel',
    'spellblock',
    'attackdamage',
    'attackdamageperlevel',
    'attackspeed',
    'attackspeedperlevel',
    'attackrange',
    'movespeed',
  ];
  const norm = fields.map((f) => {
    const values = champions.map((x) => x.stats[f] ?? 0);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length) || 1;
    return { f, mean, sd };
  });
  const vec = (x: Champion) => norm.map(({ f, mean, sd }) => ((x.stats[f] ?? 0) - mean) / sd);
  const target = vec(c);
  return DATA[lang]
    .filter((x) => x.id !== c.id)
    .map((x) => {
      const v = vec(x);
      let d = Math.sqrt(v.reduce((acc, val, i) => acc + (val - target[i]) ** 2, 0));
      if (x.tags[0] !== c.tags[0]) d += 2.5;
      if (!x.tags.some((t) => c.tags.includes(t))) d += 1.5;
      if (x.tactical?.attackType !== c.tactical?.attackType) d += 2;
      return { x, d };
    })
    .sort((a, b) => a.d - b.d)
    .slice(0, count)
    .map(({ x }) => x);
}

export const totalSkins = champions.reduce((n, c) => n + c.skins.length - 1, 0);

/** Новейшие чемпионы; без даты выхода в источнике — самые новые. */
export function newestChampions(lang: Locale, count = 4) {
  return DATA[lang]
    .toSorted((a, b) => {
      if (!a.releaseDate && !b.releaseDate) return b.key - a.key;
      if (!a.releaseDate) return -1;
      if (!b.releaseDate) return 1;
      return b.releaseDate.localeCompare(a.releaseDate);
    })
    .slice(0, count);
}

/* ───────────── Компактные данные для клиента ───────────── */

export interface ChampionLite {
  id: string;
  slug: string;
  name: string;
  title: string;
  tags: ClassTag[];
  positions: Position[];
  partype: string;
  resource: string;
  difficulty: number;
  attackType: string;
  damageType: string;
  info: Champion['info'];
  playstyle: Champion['playstyle'];
  stats: BaseStats;
  /** порядок по новизне: 0 — самый новый */
  release: number;
}

const releaseRank = new Map(newestChampions(DEFAULT_LOCALE, champions.length).map((c, i) => [c.id, i]));

/** Минимум данных для интерактивных страниц (выбор чемпиона, каталог, сравнение, рейтинги). */
export function championsLite(lang: Locale): ChampionLite[] {
  return DATA[lang].map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    title: c.title,
    tags: c.tags,
    positions: c.positions,
    partype: c.partype,
    resource: c.resource,
    difficulty: difficultyLevel(c),
    attackType: c.tactical?.attackType ?? '',
    damageType: c.tactical?.damageType ?? '',
    info: c.info,
    playstyle: c.playstyle,
    stats: c.stats,
    release: releaseRank.get(c.id) ?? 999,
  }));
}
