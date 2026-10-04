// Регионы Рунтерры: типы и места на карте. Данные — src/data/regions.json (scripts/fetch-regions.mjs).

export interface Region {
  slug: string;
  name: string;
  /** абзацы описания из Universe */
  text: string[];
  image: string | null;
  video: string | null;
  /** id чемпионов региона */
  champions: string[];
}

export interface RegionsData {
  regions: Region[];
  unaffiliated: string[];
}

/** Карта мира — обзорная текстура местности с официальной карты Рунтерры, 2048 × 2048. */
export const MAP_IMAGE = 'https://map.leagueoflegends.com/assets/images/tiles/terrain_z1.jpg';

/**
 * Где регион на карте (доли стороны квадратной карты) и во сколько раз приближать камеру.
 * hidden — региона нет на картах, метка рисуется пунктиром.
 */
export const REGION_PLACES: Record<string, { x: number; y: number; zoom: number; hidden?: boolean }> = {
  freljord: { x: 0.3, y: 0.33, zoom: 2.3 },
  demacia: { x: 0.22, y: 0.45, zoom: 2.7 },
  noxus: { x: 0.47, y: 0.46, zoom: 2.4 },
  piltover: { x: 0.618, y: 0.535, zoom: 4 },
  zaun: { x: 0.598, y: 0.566, zoom: 4 },
  ionia: { x: 0.755, y: 0.4, zoom: 2.7 },
  bilgewater: { x: 0.755, y: 0.585, zoom: 3.6 },
  'shadow-isles': { x: 0.882, y: 0.69, zoom: 3.4 },
  shurima: { x: 0.53, y: 0.68, zoom: 2.1 },
  'mount-targon': { x: 0.41, y: 0.715, zoom: 3.3 },
  ixtal: { x: 0.665, y: 0.64, zoom: 3.1 },
  void: { x: 0.64, y: 0.785, zoom: 3.1 },
  'bandle-city': { x: 0.17, y: 0.66, zoom: 2.6, hidden: true },
};

/** Общий план: вся суша в кадре. */
export const OVERVIEW = { x: 0.53, y: 0.56, zoom: 1.12 };

/** Галереи и рассказы для страницы региона — src/data/region-pages.json. */
export interface RegionPage {
  galleries: { title: string; images: { title: string; description: string; uri: string; width: number | null; height: number | null }[] }[];
  stories: { title: string; kind: 'comic' | 'story'; url: string }[];
}

/** Лор чемпиона из Universe — src/data/lore.json. */
export interface ChampionLore {
  bio: string[];
  quote: string;
  quoteAuthor: string | null;
  races: string[];
  /** id связанных по лору чемпионов */
  related: string[];
  stories: { title: string; url: string; minutes: number | null }[];
}

/** Ближайшие регионы по карте. */
export function nearestRegions(slug: string, count = 3) {
  const here = REGION_PLACES[slug];
  if (!here) return [];
  return Object.entries(REGION_PLACES)
    .filter(([s]) => s !== slug)
    .map(([s, p]) => ({ slug: s, distance: Math.hypot(p.x - here.x, p.y - here.y) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, count)
    .map((r) => r.slug);
}

/** Маршрут путешествия: по кругу от Фрельйорда через Валоран, острова и Шуриму. */
export const TOUR_ROUTE = ['freljord', 'demacia', 'noxus', 'piltover', 'zaun', 'ionia', 'bilgewater', 'shadow-isles', 'void', 'ixtal', 'shurima', 'mount-targon', 'bandle-city'];

/** Связи региона с другими: сколько пар знакомых по лору чемпионов, по убыванию. relations — взаимные. */
export function regionTies(champions: string[], home: string, relations: Record<string, string[]>, regionOf: (id: string) => string | undefined) {
  const ties = new Map<string, number>();
  for (const id of champions) {
    for (const other of relations[id] ?? []) {
      const r = regionOf(other);
      if (r && r !== home) ties.set(r, (ties.get(r) ?? 0) + 1);
    }
  }
  return [...ties].map(([slug, count]) => ({ slug, count })).sort((a, b) => b.count - a.count);
}
