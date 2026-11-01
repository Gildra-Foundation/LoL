import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { plural } from '@rift/engine/lib/format';
import { SkinSetPage } from '@/components/skins/SkinSetPage';
import { alternates, defineMessages, langOf, ogLocale } from '@/lib/i18n';
import { RARITIES } from '@/lib/labels';
import { RARITY_ORDER, cdAsset, rarityHref, rarityOfSlug, raritySlug } from '@/lib/skin-assets';
import { rarityCounts, skinsOfRarity } from '@/lib/skins';

const MESSAGES = defineMessages({
  ru: {
    metaTitle: (name: string) => `${name} образы League of Legends`,
    metaDescription: (name: string, n: number) => `Все ${n} ${plural(n, ['образ', 'образа', 'образов'], 'ru')} редкости «${name}» в League of Legends: от новых к старым, со сплэш-артами, ценами и наборами.`,
    title: (name: string) => `${name} образы`,
    skins: 'Образы',
    list: (n: number) => `${n} ${plural(n, ['образ', 'образа', 'образов'], 'ru')}, сначала новые`,
    catalog: 'В каталоге с фильтрами',
  },
  en: {
    metaTitle: (name: string) => `${name} League of Legends skins`,
    metaDescription: (name: string, n: number) => `All ${n} ${name} ${plural(n, ['skin', 'skins', 'skins'], 'en')} in League of Legends, newest first, with splash art, prices and skin lines.`,
    title: (name: string) => `${name} skins`,
    skins: 'Skins',
    list: (n: number) => `${n} ${plural(n, ['skin', 'skins', 'skins'], 'en')}, newest first`,
    catalog: 'Open in the catalog',
  },
});

/** Названия редкостей во множественном числе для заголовка: «Легендарные образы». */
const PLURAL_RU: Record<string, string> = {
  kRare: 'Редкие', kEpic: 'Эпические', kLegendary: 'Легендарные', kMythic: 'Мифические', kUltimate: 'Ультимативные', kExalted: 'Возвышенные', kTranscendent: 'Трансцендентные',
};

export const dynamicParams = false;
export const generateStaticParams = () => rarityCounts().map((r) => ({ rarity: raritySlug(r.rarity) }));

type Params = { params: Promise<{ lang: string; rarity: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { rarity: slug } = await params;
  const lang = await langOf(params);
  const rarity = rarityOfSlug(slug);
  if (!rarity) return {};
  const skins = skinsOfRarity(rarity, lang);
  const name = lang === 'ru' ? PLURAL_RU[rarity] : RARITIES[lang][rarity].label;
  return {
    title: MESSAGES[lang].metaTitle(name),
    description: MESSAGES[lang].metaDescription(RARITIES[lang][rarity].label, skins.length),
    alternates: alternates(lang, rarityHref(rarity)),
    openGraph: { images: skins[0]?.images.splash ? [cdAsset(skins[0].images.splash)] : [], ...ogLocale(lang) },
  };
}

export default async function RarityPage({ params }: Params) {
  const { rarity: slug } = await params;
  const lang = await langOf(params);
  const rarity = rarityOfSlug(slug);
  if (!rarity || !RARITY_ORDER.includes(rarity)) notFound();
  const t = MESSAGES[lang];
  const skins = skinsOfRarity(rarity, lang);
  const name = lang === 'ru' ? PLURAL_RU[rarity] : RARITIES[lang][rarity].label;
  return (
    <SkinSetPage
      lang={lang}
      crumbs={[
        { name: t.skins, path: '/skins' },
        { name: t.title(name), path: rarityHref(rarity) },
      ]}
      title={t.title(name)}
      skins={skins}
      listTitle={t.list(skins.length)}
      catalogHref={`/skins?rarity=${slug}`}
      catalogLabel={t.catalog}
    />
  );
}
