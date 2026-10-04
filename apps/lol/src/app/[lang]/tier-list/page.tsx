import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TierListSkeleton } from '@rift/engine/tierlist/TierList';
import type { TierItem } from '@rift/engine/tierlist/model';
import { PageHead } from '@rift/engine/ui/PageHead';
import { LolTierList } from '@/components/tierlist/LolTierList';
import { getChampions } from '@/lib/champions';
import { LOCALE_TAG, alternates, defineMessages, langOf } from '@/lib/i18n';

const MESSAGES = defineMessages({
  ru: {
    title: 'Тир-лист',
    metaDescription: 'Конструктор тир-листа League of Legends: расставьте чемпионов по тирам от S до D для каждой линии и поделитесь ссылкой.',
    lead: 'Расставьте чемпионов по тирам для каждой линии: перетащите портрет или выберите чемпиона и нажмите S, A, B, C или D. Расстановка хранится в этом браузере, а ссылкой на неё можно поделиться.',
  },
  en: {
    title: 'Tier list',
    metaDescription: 'League of Legends tier list maker: rank champions from S to D for each lane and share the link.',
    lead: 'Rank champions into tiers for each lane: drag a portrait, or pick a champion and press S, A, B, C or D. Your tier list is saved in this browser, and you can share it with a link.',
  },
});

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const lang = await langOf(params);
  const t = MESSAGES[lang];
  return { title: t.title, description: t.metaDescription, alternates: alternates(lang, '/tier-list') };
}

export default async function TierListPage({ params }: { params: Promise<{ lang: string }> }) {
  const lang = await langOf(params);
  const t = MESSAGES[lang];
  // группы чемпиона — его линии: так у каждой линии свой тир-лист
  const data: TierItem[] = getChampions(lang)
    .map((c) => ({ id: c.id, slug: c.slug, name: c.name, groups: c.positions }))
    .sort((a, b) => a.name.localeCompare(b.name, LOCALE_TAG[lang]));

  return (
    <div className="container">
      <PageHead title={t.title}>{t.lead}</PageHead>
      <Suspense fallback={<TierListSkeleton />}>
        <LolTierList items={data} />
      </Suspense>
    </div>
  );
}
