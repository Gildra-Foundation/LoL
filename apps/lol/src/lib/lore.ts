// Регионы и лор из src/data/<язык> — только для сервера.
import 'server-only';
import enLore from '../data/en/lore.json';
import enPages from '../data/en/region-pages.json';
import enRegions from '../data/en/regions.json';
import ruLore from '../data/ru/lore.json';
import ruPages from '../data/ru/region-pages.json';
import ruRegions from '../data/ru/regions.json';
import { getChampion } from './champions';
import { DEFAULT_LOCALE, type Locale } from './i18n';
import { regionTies, type ChampionLore, type Region, type RegionPage, type RegionsData } from './regions';

const REGIONS = { ru: ruRegions, en: enRegions } as unknown as Record<Locale, RegionsData>;
const PAGES = { ru: ruPages, en: enPages } as unknown as Record<Locale, Record<string, RegionPage>>;
const LORE = { ru: ruLore, en: enLore } as unknown as Record<Locale, Record<string, ChampionLore>>;

export const getRegionsInfo = (lang: Locale) => REGIONS[lang];
export const getRegionPages = (lang: Locale) => PAGES[lang];
export const getLore = (lang: Locale) => LORE[lang];

// состав регионов одинаков на всех языках — карта «чемпион → регион» строится по основному
const homeSlug = new Map(REGIONS[DEFAULT_LOCALE].regions.flatMap((r) => r.champions.map((id) => [id, r.slug] as const)));

/** Родной регион чемпиона на языке страницы или undefined, если его нет. */
export const regionOf = (championId: string, lang: Locale): Region | undefined => {
  const slug = homeSlug.get(championId);
  return slug ? getRegion(slug, lang) : undefined;
};

export const getRegion = (slug: string, lang: Locale) => REGIONS[lang].regions.find((r) => r.slug === slug);

// в Universe связь бывает указана только у одного из двух чемпионов — делаем её взаимной
const links = new Map<string, Set<string>>();
const link = (a: string, b: string) => links.set(a, (links.get(a) ?? new Set()).add(b));
for (const [id, l] of Object.entries(LORE[DEFAULT_LOCALE])) {
  for (const other of l.related) {
    if (other === id || !getChampion(id, DEFAULT_LOCALE) || !getChampion(other, DEFAULT_LOCALE)) continue;
    link(id, other);
    link(other, id);
  }
}

/** Связи чемпионов по лору в обе стороны: id → id знакомых. Только id, чтобы не везти в браузер биографии. */
export const relations: Record<string, string[]> = Object.fromEntries([...links].map(([id, s]) => [id, [...s]]));

/** Связи региона с другими регионами: сколько пар знакомых чемпионов. */
export const tiesOf = (slug: string) =>
  regionTies(REGIONS[DEFAULT_LOCALE].regions.find((r) => r.slug === slug)?.champions ?? [], slug, relations, (id) => homeSlug.get(id));
