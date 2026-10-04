import type { Metadata } from 'next';
import { Suspense } from 'react';
import { DuelArena, type DuelChampion } from '@/components/duel/DuelArena';
import { PageHead } from '@rift/engine/ui/PageHead';
import { getChampions } from '@/lib/champions';
import { LOCALE_TAG, alternates, defineMessages, langOf } from '@/lib/i18n';

const MESSAGES = defineMessages({
  ru: {
    title: 'Дуэль',
    metaDescription:
      'Симулятор дуэли League of Legends на автоатаках: два чемпиона бьют друг друга на любом уровне, с бронёй, скоростью атаки и форой по дальности.',
    lead: 'Два чемпиона бьют друг друга одними автоатаками. Урон считается по силе атаки и броне, темп — по скорости атаки, а дальний бьёт первым, пока ближний подходит.',
  },
  en: {
    title: 'Duel',
    metaDescription:
      'League of Legends basic attack duel simulator: two champions hit each other at any level, with armor, attack speed and a head start for the longer range.',
    lead: 'Two champions hit each other with basic attacks only. Damage comes from attack damage and armor, the pace from attack speed, and the ranged champion strikes first while the melee one closes in.',
  },
});

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const lang = await langOf(params);
  const t = MESSAGES[lang];
  return { title: t.title, description: t.metaDescription, alternates: alternates(lang, '/duel') };
}

export default async function DuelPage({ params }: { params: Promise<{ lang: string }> }) {
  const lang = await langOf(params);
  const t = MESSAGES[lang];
  const data: DuelChampion[] = getChampions(lang)
    .map((c) => ({ id: c.id, slug: c.slug, name: c.name, title: c.title, stats: c.stats }))
    .sort((a, b) => a.name.localeCompare(b.name, LOCALE_TAG[lang]));

  return (
    <div className="container">
      <PageHead title={t.title}>{t.lead}</PageHead>
      <Suspense fallback={<div style={{ minHeight: 560 }} />}>
        <DuelArena champions={data} defaults={{ a: 'garen', b: 'darius', level: 6 }} />
      </Suspense>
    </div>
  );
}
