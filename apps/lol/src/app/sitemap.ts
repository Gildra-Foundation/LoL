import type { MetadataRoute } from 'next';
import { UPDATED_AT, getChampions } from '@/lib/champions';
import { DEFAULT_LOCALE, LOCALES, SITE_URL, localePath, type Locale } from '@/lib/i18n';
import { getRegionsInfo } from '@/lib/lore';
import { lineHref, rarityHref, skinHref, universeHref } from '@/lib/skin-assets';
import { getLines, getSkins, getUniverses, rarityCounts } from '@/lib/skins';

// Карта сайта: каждая страница на каждом языке со ссылками на остальные языки (hreflang).
const SECTIONS = ['/', '/champions', '/skins', '/runeterra', '/items', '/builds', '/tier-list', '/stats', '/compare', '/duel', '/guess', '/methodology', '/privacy'];

const url = (lang: Locale, path: string) => SITE_URL + localePath(lang, path);

export default function sitemap(): MetadataRoute.Sitemap {
  const shared = [
    ...SECTIONS,
    ...getChampions(DEFAULT_LOCALE).map((c) => `/champions/${c.slug}`),
    ...getRegionsInfo(DEFAULT_LOCALE).regions.map((r) => `/runeterra/${r.slug}`),
    ...getSkins(DEFAULT_LOCALE).map((s) => skinHref(s.slug)),
    ...getLines(DEFAULT_LOCALE).map((l) => lineHref(l.slug)),
    ...getUniverses(DEFAULT_LOCALE).map((u) => universeHref(u.slug)),
    ...rarityCounts().map((r) => rarityHref(r.rarity)),
  ];
  const pages: MetadataRoute.Sitemap = shared.flatMap((path) =>
    LOCALES.map((lang) => ({
      url: url(lang, path),
      lastModified: UPDATED_AT,
      alternates: { languages: Object.fromEntries(LOCALES.map((l) => [l, url(l, path)])) },
    })),
  );

  return pages;
}
