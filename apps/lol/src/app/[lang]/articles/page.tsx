import type { Metadata } from 'next';
import { ArticleList } from '@rift/engine/articles/ArticleList';
import { PageHead } from '@rift/engine/ui/PageHead';
import { CATEGORIES, getArticles } from '@/lib/articles';
import { alternates, defineMessages, langOf } from '@/lib/i18n';

const MESSAGES = defineMessages({
  ru: {
    title: 'Статьи',
    description: 'Статьи о League of Legends: как считается урон и рост характеристик, управление волной, обзор, роли и чемпионы для новичков.',
    lead: 'Механики, макро-игра и советы новичкам. Рейтинги внутри статей берутся из базы и обновляются вместе с патчем.',
    empty: 'Статей пока нет. Загляните позже.',
  },
  en: {
    title: 'Articles',
    description: 'Articles about League of Legends: how damage and stat growth work, wave management, vision, roles and champions for beginners.',
    lead: 'Mechanics, macro play and tips for beginners. Rankings inside the articles come from the database and update with each patch.',
    empty: 'No articles yet. Check back later.',
  },
});

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const lang = await langOf(params);
  const t = MESSAGES[lang];
  return { title: t.title, description: t.description, alternates: alternates(lang, '/articles') };
}

export default async function ArticlesPage({ params }: Props) {
  const lang = await langOf(params);
  const t = MESSAGES[lang];
  const articles = getArticles(lang).map(({ slug, title, description, category, date, coverUrl, readingTime, featured }) => ({
    slug,
    title,
    description,
    category,
    date: date.toISOString(),
    coverUrl,
    readingTime,
    featured,
  }));
  const categories = CATEGORIES[lang].filter((c) => articles.some((a) => a.category === c));

  return (
    <div className="container">
      <PageHead title={t.title}>{articles.length > 0 ? t.lead : t.empty}</PageHead>
      {articles.length > 0 && <ArticleList articles={articles} categories={[...categories]} />}
    </div>
  );
}
