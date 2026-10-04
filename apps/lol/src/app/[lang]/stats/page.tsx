import type { Metadata } from 'next';
import { StatsBoard, type BoardChampion } from '@/components/stats/StatsBoard';
import { PATCH } from '@/lib/assets';
import { getChampions } from '@/lib/champions';
import { alternates, defineMessages, langOf } from '@/lib/i18n';
import { PageHead } from '@rift/engine/ui/PageHead';

const MESSAGES = defineMessages({
  ru: {
    metaTitle: 'Рейтинги чемпионов',
    metaDescription: `Рейтинги чемпионов League of Legends по здоровью, броне, урону и скорости на любом уровне: таблица, лидеры, средние по классам. Патч ${PATCH}.`,
    title: 'Рейтинги',
    lead: (count: number) =>
      `Все ${count} чемпионов на одной шкале, без предметов и рун. Выберите уровень — таблица, лидеры, средние по классам и диаграмма пересчитаются по формуле роста из игры.`,
  },
  en: {
    metaTitle: 'Champion rankings',
    metaDescription: `League of Legends champion rankings by health, armor, damage and speed at any level: a table, leaders and class averages. Patch ${PATCH}.`,
    title: 'Rankings',
    lead: (count: number) =>
      `All ${count} champions on one scale, without items or runes. Pick a level and the table, leaders, class averages and chart are recalculated with the in-game growth formula.`,
  },
});

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const lang = await langOf(params);
  const t = MESSAGES[lang];
  return { title: t.metaTitle, description: t.metaDescription, alternates: alternates(lang, '/stats') };
}

export default async function StatsPage({ params }: { params: Promise<{ lang: string }> }) {
  const lang = await langOf(params);
  const t = MESSAGES[lang];
  const champions = getChampions(lang);
  const data: BoardChampion[] = champions.map((c) => ({ id: c.id, slug: c.slug, name: c.name, tags: c.tags, stats: c.stats }));
  return (
    <div className="container">
      <PageHead title={t.title}>{t.lead(champions.length)}</PageHead>
      <StatsBoard champions={data} />
    </div>
  );
}
