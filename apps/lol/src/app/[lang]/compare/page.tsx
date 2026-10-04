import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CompareView, type CompareChampion } from '@/components/compare/CompareView';
import { PATCH } from '@/lib/assets';
import { difficultyLevel, getChampions, similarChampions } from '@/lib/champions';
import { alternates, defineMessages, langOf } from '@/lib/i18n';
import { PageHead } from '@rift/engine/ui/PageHead';

const MESSAGES = defineMessages({
  ru: {
    metaTitle: 'Сравнение чемпионов',
    metaDescription: `Сравните двух чемпионов League of Legends на любом уровне: здоровье, урон, защита, скорость и стиль игры. Патч ${PATCH}.`,
    title: 'Сравнение',
    lead: 'Левый чемпион играет за синюю сторону, правый — за красную. Цвет показывает, у кого больше на выбранном уровне.',
  },
  en: {
    metaTitle: 'Champion comparison',
    metaDescription: `Compare two League of Legends champions at any level: health, damage, defense, speed and playstyle. Patch ${PATCH}.`,
    title: 'Compare',
    lead: 'The left champion plays on the blue side, the right one on the red side. The color shows who has more at the selected level.',
  },
});

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const lang = await langOf(params);
  const t = MESSAGES[lang];
  return { title: t.metaTitle, description: t.metaDescription, alternates: alternates(lang, '/compare') };
}

export default async function ComparePage({ params }: { params: Promise<{ lang: string }> }) {
  const lang = await langOf(params);
  const t = MESSAGES[lang];
  const data: CompareChampion[] = getChampions(lang).map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    title: c.title,
    tags: c.tags,
    positions: c.positions,
    partype: c.partype,
    attackType: c.tactical?.attackType ?? '',
    damageType: c.tactical?.damageType ?? '',
    difficulty: difficultyLevel(c),
    info: c.info,
    playstyle: c.playstyle,
    stats: c.stats,
    rival: similarChampions(c, lang, 1)[0].slug,
  }));

  return (
    <div className="container">
      <PageHead title={t.title}>{t.lead}</PageHead>
      <Suspense>
        <CompareView champions={data} />
      </Suspense>
    </div>
  );
}
