import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHead } from '@rift/engine/ui/PageHead';
import { RuneterraMap, type MapChampion } from '@/components/runeterra/RuneterraMap';
import { getChampions } from '@/lib/champions';
import { alternates, defineMessages, langOf } from '@/lib/i18n';
import { getRegionsInfo, relations } from '@/lib/lore';

const MESSAGES = defineMessages({
  ru: {
    title: 'Рунтерра',
    description: 'Карта Рунтерры — мира League of Legends: регионы, их история и чемпионы.',
    lead: 'Мир League of Legends. Выберите регион — камера подлетит к нему, рядом откроются история и чемпионы, а линии покажут, с кем они связаны в других землях.',
  },
  en: {
    title: 'Runeterra',
    description: 'Map of Runeterra, the world of League of Legends: regions, their history and champions.',
    lead: 'The world of League of Legends. Pick a region and the camera flies to it, its history and champions open alongside, and lines show who they are connected to in other lands.',
  },
});

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const lang = await langOf(params);
  const t = MESSAGES[lang];
  return { title: t.title, description: t.description, alternates: alternates(lang, '/runeterra') };
}

export default async function RuneterraPage({ params }: Props) {
  const lang = await langOf(params);
  const t = MESSAGES[lang];
  const data = getRegionsInfo(lang);
  const people: MapChampion[] = getChampions(lang).map((c) => ({ id: c.id, slug: c.slug, name: c.name }));
  return (
    <div className="container">
      <PageHead title={t.title}>{t.lead}</PageHead>
      <Suspense fallback={<div style={{ aspectRatio: '16 / 9.4' }} />}>
        <RuneterraMap regions={data.regions} unaffiliated={data.unaffiliated} champions={people} relations={relations} />
      </Suspense>
    </div>
  );
}
