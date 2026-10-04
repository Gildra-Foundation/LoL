import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArticleCard } from '@rift/engine/articles/ArticleCard';
import { TableOfContents } from '@rift/engine/articles/TableOfContents';
import Link from '@rift/engine/i18n/Link';
import { ChampionChip } from '@/components/champion/ChampionChip';
import { MdxContent } from '@rift/engine/mdx/MdxContent';
import { mdxComponentsFor } from '@/components/mdx/components';
import { Icon } from '@/components/Icon';
import { getArticle, getArticles } from '@/lib/articles';
import { img } from '@/lib/assets';
import { getChampion, type Champion } from '@/lib/champions';
import { DEFAULT_LOCALE, LOCALES, alternates, defineMessages, isLocale, langOf, localePath } from '@/lib/i18n';
import { formatDate, plural } from '@rift/engine/lib/format';
import styles from './page.module.css';

const MESSAGES = defineMessages({
  ru: {
    crumbs: 'Навигация',
    articles: 'Статьи',
    reading: (n: number) => `${n} ${plural(n, ['минута', 'минуты', 'минут'], 'ru')} чтения`,
    champions: 'Чемпионы в статье',
    readNext: 'Читать дальше',
  },
  en: {
    crumbs: 'Breadcrumb',
    articles: 'Articles',
    reading: (n: number) => `${n} min read`,
    champions: 'Champions in this article',
    readNext: 'Read next',
  },
});

// статьи у каждого языка свои; пустой список — страниц нет, любой адрес отдаёт 404
export const dynamicParams = false;

export function generateStaticParams({ params }: { params: { lang: string } }) {
  return getArticles(isLocale(params.lang) ? params.lang : DEFAULT_LOCALE).map((a) => ({ slug: a.slug }));
}

type Params = { params: Promise<{ lang: string; slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const lang = await langOf(params);
  const article = getArticle(slug, lang);
  if (!article) return {};
  const path = `/articles/${slug}`;
  // ссылки на другие языки — только если статья есть на всех
  const everywhere = LOCALES.every((l) => getArticle(slug, l));
  return {
    title: article.title,
    description: article.description,
    alternates: everywhere ? alternates(lang, path) : { canonical: localePath(lang, path) },
    openGraph: { type: 'article', images: [img.centered(article.cover.champion, article.cover.skin)] },
  };
}

export default async function ArticlePage({ params }: Params) {
  const { slug } = await params;
  const lang = await langOf(params);
  const t = MESSAGES[lang];
  const article = getArticle(slug, lang);
  if (!article) notFound();

  const mentioned = article.champions.map((id) => getChampion(id, lang)).filter((c): c is Champion => c !== undefined);
  const related = getArticles(lang)
    .filter((a) => a.slug !== article.slug)
    .toSorted((a, b) => Number(b.category === article.category) - Number(a.category === article.category))
    .slice(0, 3);

  return (
    <article>
      <header className={styles.hero}>
        <div className={styles.cover} aria-hidden="true">
          <img src={img.centered(article.cover.champion, article.cover.skin)} alt="" width={1280} height={720} fetchPriority="high" />
        </div>
        <div className={`container ${styles.heroContent}`}>
          <nav className={styles.crumbs} aria-label={t.crumbs}>
            <Link href="/articles">{t.articles}</Link>
            <Icon name="chevron-right" size={14} />
            <span>{article.category}</span>
          </nav>
          <h1>{article.title}</h1>
          <p className={styles.description}>{article.description}</p>
          <p className={styles.meta}>
            <span>{article.author}</span>
            <time dateTime={article.date.toISOString()}>{formatDate(article.date, lang)}</time>
            <span>{t.reading(article.readingTime)}</span>
          </p>
        </div>
      </header>

      <div className={`container ${styles.layout}`}>
        {article.toc.length > 1 && (
          <aside className={styles.aside}>
            <TableOfContents items={article.toc} />
          </aside>
        )}
        <div className={styles.prose}>
          <MdxContent source={article.body} components={mdxComponentsFor(lang)} />
        </div>
      </div>

      <div className="container">
        {mentioned.length > 0 && (
          <section className={styles.block}>
            <h2>{t.champions}</h2>
            <div className={styles.chips}>
              {mentioned.map((c) => (
                <ChampionChip key={c.id} id={c.id} slug={c.slug} name={c.name} tags={c.tags} />
              ))}
            </div>
          </section>
        )}
        {related.length > 0 && (
          <section className={styles.block}>
            <h2>{t.readNext}</h2>
            <div className={styles.related}>
              {related.map((a) => (
                <ArticleCard key={a.slug} article={a} />
              ))}
            </div>
          </section>
        )}
      </div>
    </article>
  );
}
