import Link from '@rift/engine/i18n/Link';
import { Icon } from '@/components/Icon';
import { JsonLd } from '@/components/seo/JsonLd';
import { getChampion } from '@/lib/champions';
import type { Locale } from '@/lib/i18n';
import { breadcrumbData } from '@/lib/seo';
import { cdAsset } from '@/lib/skin-assets';
import type { Skin } from '@/lib/skins';
import { SkinGrid } from './SkinCard';
import styles from '../../app/[lang]/skins/skins.module.css';

/** Больше карточек на странице не выводим: остальные — в каталоге с тем же фильтром. */
const LIMIT = 60;

interface SkinSetPageProps {
  lang: Locale;
  crumbs: { name: string; path: string }[];
  title: string;
  lead?: string | null;
  tags?: React.ReactNode;
  skins: Skin[];
  /** заголовок списка и ссылка «все в каталоге» */
  listTitle: string;
  catalogHref: string;
  catalogLabel: string;
  /** кнопка «В избранное» рядом с заголовком */
  favorite?: React.ReactNode;
  children?: React.ReactNode;
}

/** Страница группы образов: набор, тематика, редкость. Фон — сплэш самого нового образа группы. */
export function SkinSetPage({ lang, crumbs, title, lead, tags, skins, listTitle, catalogHref, catalogLabel, favorite, children }: SkinSetPageProps) {
  const cover = skins.find((s) => s.images.splash);
  const shown = skins.slice(0, LIMIT).map((s) => ({
    id: s.id,
    slug: s.slug,
    name: s.name,
    championName: getChampion(s.champion, lang)?.name ?? s.champion,
    rarity: s.rarity,
    loading: s.images.loading,
    cost: s.cost ?? null,
    chromas: s.chromas.length,
  }));
  return (
    <div>
      <JsonLd data={breadcrumbData(lang, crumbs)} />
      <section className={styles.hero}>
        {cover && (
          <div className={styles.heroBg} aria-hidden="true">
            <img src={cdAsset(cover.images.splash!)} alt="" width={1280} height={720} fetchPriority="high" />
          </div>
        )}
        <div className={`container ${styles.heroContent}`}>
          <nav className={styles.crumbs} aria-label={lang === 'ru' ? 'Навигация' : 'Breadcrumbs'}>
            {crumbs.slice(0, -1).map((c, i) => (
              <span key={c.path} style={{ display: 'contents' }}>
                {i > 0 && <Icon name="chevron-right" size={14} />}
                <Link href={c.path}>{c.name}</Link>
              </span>
            ))}
          </nav>
          <h1 className={styles.title}>{title}</h1>
          {lead && <p className={styles.lead}>{lead}</p>}
          {(tags || favorite) && (
            <div className={styles.tags}>
              {tags}
              {favorite}
            </div>
          )}
        </div>
      </section>
      <div className="container">
        {children}
        <section className={styles.block}>
          <div className={styles.blockHead}>
            <h2 className={styles.h2}>{listTitle}</h2>
            <Link href={catalogHref} className={styles.all}>
              {catalogLabel} <Icon name="chevron-right" size={14} />
            </Link>
          </div>
          <SkinGrid skins={shown} lang={lang} />
        </section>
      </div>
    </div>
  );
}
