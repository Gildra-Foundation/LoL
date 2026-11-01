import type { SearchIndex } from '@rift/engine/layout/SearchPalette';
import { plural } from '@rift/engine/lib/format';
import { championHref, img } from '@/lib/assets';
import { getChampions } from '@/lib/champions';
import { defineMessages, langOf, localeParams } from '@/lib/i18n';
import { CATEGORY_LABEL, fmtGold } from '@/lib/items';
import { CLASSES } from '@/lib/labels';
import { getRegionsInfo } from '@/lib/lore';
import { getItems } from '@/lib/shop';
import { cdAsset, lineHref, skinHref } from '@/lib/skin-assets';
import { getLines, getSkins } from '@/lib/skins';
import { RARITIES as RARITY } from '@/lib/labels';

const MESSAGES = defineMessages({
  ru: {
    champions: 'Чемпионы',
    items: 'Предметы',
    item: (category: string, gold: string) => `${category}, ${gold} золота`,
    regions: 'Регионы',
    skins: 'Образы',
    lines: 'Наборы образов',
    line: (count: number) => `Набор, образов: ${count}`,
    standard: 'Образ',
    region: (count: number) => `Регион Рунтерры, чемпионов: ${count}`,
  },
  en: {
    champions: 'Champions',
    items: 'Items',
    item: (category: string, gold: string) => `${category}, ${gold} gold`,
    regions: 'Regions',
    skins: 'Skins',
    lines: 'Skin lines',
    line: (count: number) => `Skin line, ${count} ${plural(count, ['skin', 'skins', 'skins'], 'en')}`,
    standard: 'Skin',
    region: (count: number) => `Runeterra region, ${count} ${plural(count, ['champion', 'champions', 'champions'], 'en')}`,
  },
});

// Индекс для поиска: собирается при сборке на каждом языке, загружается при первом открытии поиска.
export const dynamic = 'force-static';
export const dynamicParams = false;
export const generateStaticParams = localeParams;

export async function GET(_request: Request, { params }: { params: Promise<{ lang: string }> }) {
  const lang = await langOf(params);
  const t = MESSAGES[lang];
  const champName = new Map(getChampions(lang).map((c) => [c.id, c.name]));
  const index: SearchIndex = {
    groups: [
      {
        title: t.champions,
        limit: 8,
        // keys — английский id, чтобы находилось и «ahri», и «Ари»
        items: getChampions(lang).map((c) => ({ href: championHref(c.slug), title: c.name, sub: c.title, icon: img.icon(c.id), meta: CLASSES[lang][c.tags[0]].label, keys: [c.id] })),
      },
      {
        title: t.items,
        limit: 6,
        items: getItems(lang).map((i) => ({ href: `/items?item=${i.id}`, title: i.name, sub: t.item(CATEGORY_LABEL[lang][i.category], fmtGold(i.gold.total, lang)), icon: img.item(i.id) })),
      },
      {
        title: t.skins,
        limit: 6,
        // английское название в ключах, чтобы «star guardian» находил и русские названия
        items: getSkins(lang)
          .filter((s) => !s.base)
          .map((s) => ({
            href: skinHref(s.slug),
            title: s.name,
            sub: champName.get(s.champion) ?? s.champion,
            icon: s.images.tile ? cdAsset(s.images.tile) : undefined,
            meta: s.rarity ? RARITY[lang][s.rarity].label : t.standard,
            keys: [s.slug.replace(/-/g, ' ')],
          })),
      },
      {
        title: t.lines,
        limit: 4,
        items: getLines(lang).map((l) => ({ href: lineHref(l.slug), title: l.name, sub: t.line(l.count), keys: [l.slug.replace(/-/g, ' ')] })),
      },
      {
        title: t.regions,
        limit: 4,
        items: getRegionsInfo(lang).regions.map((r) => ({ href: `/runeterra/${r.slug}`, title: r.name, sub: t.region(r.champions.length), icon: r.image ?? undefined })),
      },
    ],
  };
  return Response.json(index);
}
