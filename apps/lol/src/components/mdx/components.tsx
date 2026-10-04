// Компоненты, доступные в статьях без импорта: <Callout>, <Champ>, <ChampionGrid>, <Formula>, <StatLeaders>.
import Link from '@rift/engine/i18n/Link';
import { ChampionChip } from '@/components/champion/ChampionChip';
import { Icon } from '@/components/Icon';
import { championHref, img } from '@/lib/assets';
import { getChampion, leaders, type Champion } from '@/lib/champions';
import { DEFAULT_LOCALE, defineMessages, type Locale } from '@/lib/i18n';
import { CLASSES, type ClassTag } from '@/lib/labels';
import { STATS, fmtStat, type StatKey } from '@/lib/stats';
import styles from './mdx.module.css';

const MESSAGES = defineMessages({
  ru: {
    callout: { tip: 'Совет', info: 'На заметку', warning: 'Осторожно' },
    lowest: (label: string) => `${label}: самые низкие значения`,
    atLevel: (level: number) => `на ${level} уровне`,
  },
  en: {
    callout: { tip: 'Tip', info: 'Note', warning: 'Careful' },
    lowest: (label: string) => `${label}: lowest values`,
    atLevel: (level: number) => `at level ${level}`,
  },
});

const CALLOUT = {
  tip: { icon: 'tip' },
  info: { icon: 'info' },
  warning: { icon: 'warning' },
} as const;

interface CalloutProps {
  type?: keyof typeof CALLOUT;
  title?: string;
  children: React.ReactNode;
  lang?: Locale;
}

export function Callout({ type = 'info', title, children, lang = DEFAULT_LOCALE }: CalloutProps) {
  const meta = CALLOUT[type] ?? CALLOUT.info;
  const t = MESSAGES[lang];
  return (
    <aside className={`${styles.callout} ${styles[type]}`}>
      <p className={styles.calloutTitle}>
        <Icon name={meta.icon} size={18} />
        {title ?? t.callout[type] ?? t.callout.info}
      </p>
      <div className={styles.calloutBody}>{children}</div>
    </aside>
  );
}

export function Champ({ id, lang = DEFAULT_LOCALE }: { id: string; lang?: Locale }) {
  const c = getChampion(id, lang);
  if (!c) return <span>{id}</span>;
  return (
    <Link href={championHref(c.slug)} className={styles.champ}>
      <img src={img.icon(c.id)} alt="" width={22} height={22} loading="lazy" />
      {c.name}
    </Link>
  );
}

export function ChampionGrid({ ids, lang = DEFAULT_LOCALE }: { ids: string[]; lang?: Locale }) {
  const list = ids.map((id) => getChampion(id, lang)).filter((c): c is Champion => c !== undefined);
  return (
    <div className={styles.grid}>
      {list.map((c) => (
        <ChampionChip key={c.id} id={c.id} slug={c.slug} name={c.name} tags={c.tags} />
      ))}
    </div>
  );
}

export function Formula({ caption, children }: { caption?: string; children: React.ReactNode }) {
  return (
    <figure className={styles.formula}>
      <div className={styles.expr}>{children}</div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

interface StatLeadersProps {
  stat: StatKey;
  level?: number;
  limit?: number;
  order?: 'asc' | 'desc';
  tag?: ClassTag;
  lang?: Locale;
}

/** Живой рейтинг из базы: пересчитывается при каждом обновлении данных. */
export function StatLeaders({ stat, level = 1, limit = 5, order = 'desc', tag, lang = DEFAULT_LOCALE }: StatLeadersProps) {
  const t = MESSAGES[lang];
  const def = STATS[lang][stat];
  const list = leaders(stat, lang, { level, limit, order, tag });
  const top = Math.max(...list.map((x) => x.value));
  const grows = Boolean(def.growth) || !def.base;
  const caption = [order === 'asc' ? t.lowest(def.label) : def.label, grows ? t.atLevel(level) : null, tag ? CLASSES[lang][tag].plural.toLowerCase() : null]
    .filter(Boolean)
    .join(', ');

  return (
    <figure className={styles.leaders} style={{ '--accent': def.color } as React.CSSProperties}>
      <figcaption>{caption}</figcaption>
      <ol role="list">
        {list.map(({ champion, value }, i) => (
          <li key={champion.id}>
            <span className={i === 0 ? styles.first : styles.pos}>{i + 1}</span>
            <Link href={championHref(champion.slug)}>
              <img src={img.icon(champion.id)} alt="" width={30} height={30} loading="lazy" />
              {champion.name}
            </Link>
            <span className={styles.bar} aria-hidden="true">
              <i style={{ width: `${((value / top) * 100).toFixed(1)}%` }} />
            </span>
            <span className={`num ${styles.value}`}>{fmtStat(stat, value, lang)}</span>
          </li>
        ))}
      </ol>
    </figure>
  );
}

/** Компоненты статей на языке страницы: <MdxContent components={mdxComponentsFor(lang)} />. */
export const mdxComponentsFor = (lang: Locale) => ({
  Callout: (props: CalloutProps) => <Callout {...props} lang={lang} />,
  Champ: (props: { id: string }) => <Champ {...props} lang={lang} />,
  ChampionGrid: (props: { ids: string[] }) => <ChampionGrid {...props} lang={lang} />,
  Formula,
  StatLeaders: (props: StatLeadersProps) => <StatLeaders {...props} lang={lang} />,
});

export const mdxComponents = mdxComponentsFor(DEFAULT_LOCALE);
