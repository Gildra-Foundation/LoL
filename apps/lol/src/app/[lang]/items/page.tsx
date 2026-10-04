import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHead } from '@rift/engine/ui/PageHead';
import { ItemLibrary } from '@/components/items/ItemLibrary';
import { PATCH } from '@/lib/assets';
import { alternates, defineMessages, langOf } from '@/lib/i18n';
import { getItems } from '@/lib/shop';

const MESSAGES = defineMessages({
  ru: {
    title: 'Предметы',
    description: `Все предметы Ущелья призывателей в League of Legends, патч ${PATCH}: цена, характеристики, эффекты, рецепт и улучшения.`,
    lead: (n: number) =>
      `${n} предметов Ущелья призывателей, патч ${PATCH}: цена, характеристики, рецепт и во что собираются дальше. Нажмите на предмет, чтобы открыть его карточку.`,
  },
  en: {
    title: 'Items',
    description: `Every Summoner's Rift item in League of Legends, patch ${PATCH}: price, stats, effects, recipe and upgrades.`,
    lead: (n: number) => `${n} Summoner's Rift items, patch ${PATCH}: price, stats, recipe and what they build into. Click an item to see its details.`,
  },
});

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const lang = await langOf(params);
  const t = MESSAGES[lang];
  return { title: t.title, description: t.description, alternates: alternates(lang, '/items') };
}

export default async function ItemsPage({ params }: { params: Promise<{ lang: string }> }) {
  const lang = await langOf(params);
  const t = MESSAGES[lang];
  const items = getItems(lang);
  return (
    <div className="container">
      <PageHead title={t.title}>{t.lead(items.length)}</PageHead>
      <Suspense fallback={<div style={{ minHeight: 640 }} />}>
        <ItemLibrary items={items} />
      </Suspense>
    </div>
  );
}
