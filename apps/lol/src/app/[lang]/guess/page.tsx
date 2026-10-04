import type { Metadata } from 'next';
import { PageHead } from '@rift/engine/ui/PageHead';
import { LolGuessGame } from '@/components/guess/LolGuessGame';
import { difficultyLevel, getChampions } from '@/lib/champions';
import type { GuessChampion } from '@/lib/guess';
import { LOCALE_TAG, alternates, defineMessages, langOf } from '@/lib/i18n';

const MESSAGES = defineMessages({
  ru: {
    title: 'Угадай чемпиона',
    metaDescription: 'Загадка дня по League of Legends: угадайте чемпиона по классу, линии, ресурсу и году выхода или по кусочку арта.',
    lead: 'Каждый день новый загаданный чемпион, один на всех. Угадайте его по признакам или по кусочку арта. Потом можно тренироваться без ограничений.',
  },
  en: {
    title: 'Guess the champion',
    metaDescription: 'Daily League of Legends puzzle: guess the champion by class, lane, resource and release year, or by a piece of their art.',
    lead: 'A new hidden champion every day, the same for everyone. Guess them by their traits or by a piece of their art. After that, practice as much as you like.',
  },
});

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const lang = await langOf(params);
  const t = MESSAGES[lang];
  return { title: t.title, description: t.metaDescription, alternates: alternates(lang, '/guess') };
}

export default async function GuessPage({ params }: { params: Promise<{ lang: string }> }) {
  const lang = await langOf(params);
  const t = MESSAGES[lang];
  const data: GuessChampion[] = getChampions(lang)
    .map((c) => {
      const year = c.releaseDate ? Number(c.releaseDate.slice(0, 4)) : null;
      return {
        id: c.id,
        slug: c.slug,
        name: c.name,
        title: c.title,
        // без года выхода чемпион не может быть загадкой дня: колонка «Год» не сработает
        answerable: year !== null,
        tags: c.tags,
        positions: c.positions,
        attackType: c.tactical?.attackType ?? (c.stats.attackrange > 325 ? 'ranged' : 'melee'),
        resource: c.partype,
        damageType: c.tactical?.damageType ?? 'kMixed',
        difficulty: difficultyLevel(c),
        year,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, LOCALE_TAG[lang]));

  return (
    <div className="container">
      <PageHead title={t.title}>{t.lead}</PageHead>
      <LolGuessGame champions={data} />
    </div>
  );
}
