import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Tag } from '@rift/engine/ui/Tag';
import { plural } from '@rift/engine/lib/format';
import { FavoriteButton } from '@/components/favorites/FavoriteButton';
import { SkinSetPage } from '@/components/skins/SkinSetPage';
import { DEFAULT_LOCALE, alternates, defineMessages, langOf, ogLocale } from '@/lib/i18n';
import { cdAsset, lineHref, universeHref } from '@/lib/skin-assets';
import { getLineBySlug, getLines, getUniverse, skinsOfLine } from '@/lib/skins';

const MESSAGES = defineMessages({
  ru: {
    metaTitle: (name: string) => `Набор образов «${name}»`,
    metaDescription: (name: string, n: number) => `Все ${n} ${plural(n, ['образ', 'образа', 'образов'], 'ru')} набора «${name}» в League of Legends: сплэш-арты, редкость, цены и даты выхода.`,
    skins: 'Образы',
    list: (n: number) => `${n} ${plural(n, ['образ', 'образа', 'образов'], 'ru')}`,
    catalog: 'В каталоге с фильтрами',
  },
  en: {
    metaTitle: (name: string) => `${name} skin line`,
    metaDescription: (name: string, n: number) => `All ${n} ${name} ${plural(n, ['skin', 'skins', 'skins'], 'en')} in League of Legends: splash art, rarity, prices and release dates.`,
    skins: 'Skins',
    list: (n: number) => `${n} ${plural(n, ['skin', 'skins', 'skins'], 'en')}`,
    catalog: 'Open in the catalog',
  },
});

export const dynamicParams = false;
export const generateStaticParams = () => getLines(DEFAULT_LOCALE).map((l) => ({ slug: l.slug }));

type Params = { params: Promise<{ lang: string; slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const lang = await langOf(params);
  const line = getLineBySlug(slug, lang);
  if (!line) return {};
  const cover = skinsOfLine(line.id, lang).find((s) => s.images.splash);
  return {
    title: MESSAGES[lang].metaTitle(line.name),
    description: MESSAGES[lang].metaDescription(line.name, line.count),
    alternates: alternates(lang, lineHref(line.slug)),
    openGraph: { images: cover ? [cdAsset(cover.images.splash!)] : [], ...ogLocale(lang) },
  };
}

export default async function LinePage({ params }: Params) {
  const { slug } = await params;
  const lang = await langOf(params);
  const line = getLineBySlug(slug, lang);
  if (!line) notFound();
  const t = MESSAGES[lang];
  const universe = line.universe !== null ? getUniverse(line.universe, lang) : undefined;
  const skins = skinsOfLine(line.id, lang);
  return (
    <SkinSetPage
      lang={lang}
      crumbs={[
        { name: t.skins, path: '/skins' },
        ...(universe ? [{ name: universe.name, path: universeHref(universe.slug) }] : []),
        { name: line.name, path: lineHref(line.slug) },
      ]}
      title={line.name}
      lead={line.description}
      tags={universe && universe.name !== line.name ? <Tag href={universeHref(universe.slug)}>{universe.name}</Tag> : undefined}
      skins={skins}
      listTitle={t.list(skins.length)}
      catalogHref={`/skins?line=${line.slug}`}
      catalogLabel={t.catalog}
      favorite={<FavoriteButton kind="skinline" id={line.slug} />}
    />
  );
}
