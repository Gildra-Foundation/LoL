// Образы, наборы и тематики. Только для сервера: модуль тянет весь JSON (по несколько мегабайт на язык).
// Клиент получает облегчённый список через /[lang]/skins-index.json.
import 'server-only';
import enSkins from '../data/en/skins.json';
import enSets from '../data/en/skin-sets.json';
import ruSkins from '../data/ru/skins.json';
import ruSets from '../data/ru/skin-sets.json';
import { getChampion } from './champions';
import { LOCALES, type Locale } from './i18n';
import { RARITY_ORDER, type Rarity } from './skin-assets';

export interface SkinChroma {
  id: number;
  name: string;
  colors: string[];
  image: string | null;
}

export interface SkinFeatureVideo {
  name: string;
  text: string;
  icon: string | null;
  video: string;
}

export interface Skin {
  id: number;
  /** id чемпиона в Data Dragon: Ahri, MonkeyKing */
  champion: string;
  num: number;
  slug: string;
  name: string;
  base: boolean;
  rarity: Rarity | null;
  legacy: boolean;
  ultimate: boolean;
  /** вторая ступень многоступенчатого образа — id первой */
  parent: number | null;
  /** все ступени по порядку, если образ многоступенчатый */
  stages: number[] | null;
  lines: number[];
  universes: number[];
  description: string | null;
  features: string[];
  images: { splash: string | null; uncentered: string | null; tile: string | null; loading: string | null; vintage: string | null };
  video: { splash: string | null; preview: string | null; features: SkinFeatureVideo[] };
  chromas: SkinChroma[];
  // сведения League of Legends Wiki (могут отсутствовать)
  availability?: string | null;
  cost?: number | null;
  costNote?: 'special' | 'pass' | 'sanctum' | null;
  release?: string | null;
  lootEligible?: boolean;
  voiceActors?: string[];
  splashArtists?: string[];
  music?: string | null;
  new?: { voice: boolean; quotes: boolean; effects: boolean; animations: boolean; recall: boolean; transforming: boolean };
}

export interface SkinLine {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  universe: number | null;
  count: number;
}

export interface Universe {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  lines: number[];
}

const SKINS: Record<Locale, Skin[]> = { ru: ruSkins as unknown as Skin[], en: enSkins as unknown as Skin[] };
const SETS: Record<Locale, { lines: SkinLine[]; universes: Universe[] }> = { ru: ruSets, en: enSets };

const index = <T, K>(lists: Record<Locale, T[]>, key: (x: T) => K) =>
  Object.fromEntries(LOCALES.map((l) => [l, new Map(lists[l].map((x) => [key(x), x]))])) as Record<Locale, Map<K, T>>;

const skinById = index(SKINS, (s) => s.id);
const skinBySlug = index(SKINS, (s) => s.slug);
const linesOf = Object.fromEntries(LOCALES.map((l) => [l, SETS[l].lines])) as Record<Locale, SkinLine[]>;
const universesOf = Object.fromEntries(LOCALES.map((l) => [l, SETS[l].universes])) as Record<Locale, Universe[]>;
const lineById = index(linesOf, (x) => x.id);
const lineBySlug = index(linesOf, (x) => x.slug);
const universeById = index(universesOf, (x) => x.id);
const universeBySlug = index(universesOf, (x) => x.slug);

export const getSkins = (lang: Locale) => SKINS[lang];
export const getSkin = (id: number, lang: Locale) => skinById[lang].get(id);
export const getSkinBySlug = (slug: string, lang: Locale) => skinBySlug[lang].get(slug);
export const getLines = (lang: Locale) => linesOf[lang];
export const getLine = (id: number, lang: Locale) => lineById[lang].get(id);
export const getLineBySlug = (slug: string, lang: Locale) => lineBySlug[lang].get(slug);
export const getUniverses = (lang: Locale) => universesOf[lang];
export const getUniverse = (id: number, lang: Locale) => universeById[lang].get(id);
export const getUniverseBySlug = (slug: string, lang: Locale) => universeBySlug[lang].get(slug);

export const SKIN_COUNT = SKINS.en.filter((s) => !s.base).length;

/** Образы чемпиона по номеру; базовый — первым. */
export const skinsOfChampion = (champion: string, lang: Locale) => SKINS[lang].filter((s) => s.champion === champion);
export const skinsOfLine = (id: number, lang: Locale) => SKINS[lang].filter((s) => s.lines.includes(id)).toSorted(byRelease);
export const skinsOfUniverse = (id: number, lang: Locale) => SKINS[lang].filter((s) => s.universes.includes(id)).toSorted(byRelease);
export const skinsOfRarity = (rarity: Rarity, lang: Locale) => SKINS[lang].filter((s) => s.rarity === rarity).toSorted(byRelease);

/** Сначала новые; без даты — в конце. */
export function byRelease(a: Skin, b: Skin) {
  if (a.release && b.release) return b.release.localeCompare(a.release) || b.id - a.id;
  return Number(!a.release) - Number(!b.release) || b.id - a.id;
}

export const rarityCounts = () =>
  RARITY_ORDER.map((r) => ({ rarity: r, count: SKINS.en.filter((s) => s.rarity === r).length })).filter((r) => r.count > 0);

/* ───────────── Компактные данные для клиента ───────────── */

export interface SkinLite {
  id: number;
  slug: string;
  name: string;
  /** id и имя чемпиона на языке страницы */
  champion: string;
  championName: string;
  num: number;
  base: boolean;
  rarity: Rarity | null;
  legacy: boolean;
  lines: number[];
  universes: number[];
  tile: string | null;
  loading: string | null;
  chromas: number;
  availability: string | null;
  cost: number | null;
  release: string | null;
  newVoice: boolean;
}

export function skinsLite(lang: Locale): SkinLite[] {
  return SKINS[lang].map((s) => ({
    id: s.id,
    slug: s.slug,
    name: s.name,
    champion: s.champion,
    championName: getChampion(s.champion, lang)?.name ?? s.champion,
    num: s.num,
    base: s.base,
    rarity: s.rarity,
    legacy: s.legacy,
    lines: s.lines,
    universes: s.universes,
    tile: s.images.tile,
    loading: s.images.loading,
    chromas: s.chromas.length,
    availability: s.availability ?? null,
    cost: s.cost ?? null,
    release: s.release ?? null,
    newVoice: Boolean(s.new?.voice),
  }));
}
