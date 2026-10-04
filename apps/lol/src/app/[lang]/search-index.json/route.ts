import type { SearchIndex } from '@rift/engine/layout/SearchPalette';
import { plural } from '@rift/engine/lib/format';
import { getArticles } from '@/lib/articles';
import { championHref, img } from '@/lib/assets';
import { getChampions } from '@/lib/champions';
import { defineMessages, langOf, localeParams } from '@/lib/i18n';
import { CATEGORY_LABEL, fmtGold } from '@/lib/items';
import { CLASSES } from '@/lib/labels';
import { getRegionsInfo } from '@/lib/lore';
import { getItems } from '@/lib/shop';

const MESSAGES = defineMessages({
  ru: {
    champions: 'Чемпионы',
    items: 'Предметы',
    item: (category: string, gold: string) => `${category}, ${gold} золота`,
    regions: 'Регионы',
    region: (count: number) => `Регион Рунтерры, чемпионов: ${count}`,
    articles: 'Статьи',
  },
  en: {
    champions: 'Champions',
    items: 'Items',
    item: (category: string, gold: string) => `${category}, ${gold} gold`,
    regions: 'Regions',
    region: (count: number) => `Runeterra region, ${count} ${plural(count, ['champion', 'champions', 'champions'], 'en')}`,
    articles: 'Articles',
  },
});

// Индекс для поиска: собирается при сборке на каждом языке, загружается при первом открытии поиска.
export const dynamic = 'force-static';
export const dynamicParams = false;
export const generateStaticParams = localeParams;

export async function GET(_request: Request, { params }: { params: Promise<{ lang: string }> }) {
  const lang = await langOf(params);
  const t = MESSAGES[lang];
  const articles = getArticles(lang);
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
        title: t.regions,
        limit: 4,
        items: getRegionsInfo(lang).regions.map((r) => ({ href: `/runeterra/${r.slug}`, title: r.name, sub: t.region(r.champions.length), icon: r.image ?? undefined })),
      },
      ...(articles.length > 0
        ? [{ title: t.articles, limit: 4, items: articles.map((a) => ({ href: `/articles/${a.slug}`, title: a.title, sub: a.category, meta: a.category })) }]
        : []),
    ],
  };
  return Response.json(index);
}
