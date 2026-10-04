import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from '@rift/engine/i18n/Link';
import { plural } from '@rift/engine/lib/format';
import { buttonClass } from '@rift/engine/ui/Button';
import { Icon } from '@/components/Icon';
import { RegionGallery } from '@/components/runeterra/RegionGallery';
import { championHref, img } from '@/lib/assets';
import { getChampion, type Champion } from '@/lib/champions';
import { DEFAULT_LOCALE, alternates, defineMessages, langOf } from '@/lib/i18n';
import { getLore, getRegion, getRegionPages, getRegionsInfo, tiesOf } from '@/lib/lore';
import { nearestRegions } from '@/lib/regions';
import styles from './page.module.css';

const MESSAGES = defineMessages({
  ru: {
    title: (name: string) => `${name} — регион Рунтерры`,
    crumbs: 'Навигация',
    runeterra: 'Рунтерра',
    showOnMap: 'Показать на карте',
    champions: (n: number) => `${n} ${plural(n, ['чемпион', 'чемпиона', 'чемпионов'], 'ru')}`,
    story: 'История',
    regionChampions: 'Чемпионы региона',
    quote: (text: string) => `«${text}»`,
    ties: 'Связи с другими регионами',
    tiesLead: 'Сколько пар чемпионов связывают регион с другими землями — родство, союзы, вражда.',
    stories: 'Комиксы и рассказы',
    comic: 'Комикс на сайте Universe',
    shortStory: 'Рассказ на сайте Universe',
    neighbors: 'Соседи по карте',
    otherRegions: 'Другие регионы',
  },
  en: {
    title: (name: string) => `${name} — region of Runeterra`,
    crumbs: 'Breadcrumb',
    runeterra: 'Runeterra',
    showOnMap: 'Show on map',
    champions: (n: number) => `${n} ${plural(n, ['champion', 'champions', 'champions'], 'en')}`,
    story: 'History',
    regionChampions: 'Champions of the region',
    quote: (text: string) => `“${text}”`,
    ties: 'Connections to other regions',
    tiesLead: 'How many pairs of champions connect the region to other lands: family, alliances, feuds.',
    stories: 'Comics and stories',
    comic: 'Comic on Universe',
    shortStory: 'Story on Universe',
    neighbors: 'Neighbors on the map',
    otherRegions: 'Other regions',
  },
});

export const dynamicParams = false;

export function generateStaticParams() {
  return getRegionsInfo(DEFAULT_LOCALE).regions.map((r) => ({ region: r.slug }));
}

type Props = { params: Promise<{ lang: string; region: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { region: slug } = await params;
  const lang = await langOf(params);
  const region = getRegion(slug, lang);
  if (!region) return {};
  return {
    title: MESSAGES[lang].title(region.name),
    description: region.text[0],
    alternates: alternates(lang, `/runeterra/${slug}`),
    openGraph: region.image ? { images: [region.image] } : undefined,
  };
}

export default async function RegionPage({ params }: Props) {
  const { region: slug } = await params;
  const lang = await langOf(params);
  const t = MESSAGES[lang];
  const region = getRegion(slug, lang);
  if (!region) notFound();

  const page = getRegionPages(lang)[slug] ?? { galleries: [], stories: [] };
  const lore = getLore(lang);
  const champions = region.champions.map((id) => getChampion(id, lang)).filter((c): c is Champion => c !== undefined);
  const list = getRegionsInfo(lang).regions;
  const index = list.findIndex((r) => r.slug === slug);
  const prev = list[(index - 1 + list.length) % list.length];
  const next = list[(index + 1) % list.length];
  const neighbors = nearestRegions(slug).map((s) => getRegion(s, lang)).filter((r) => r !== undefined);

  const tied = tiesOf(slug).map((x) => ({ region: getRegion(x.slug, lang)!, count: x.count }));

  return (
    <>
      <section className={styles.hero}>
        <div className={styles.media} aria-hidden="true">
          {region.image && <img src={region.image} alt="" width={1920} height={888} fetchPriority="high" />}
          {region.video && <video src={region.video} poster={region.image ?? undefined} autoPlay muted loop playsInline preload="none" />}
        </div>
        <div className={`container ${styles.heroContent}`}>
          <nav className={styles.crumbs} aria-label={t.crumbs}>
            <Link href="/runeterra">{t.runeterra}</Link>
            <Icon name="chevron-right" size={14} />
            <span aria-current="page">{region.name}</span>
          </nav>
          <h1>{region.name}</h1>
          {region.text[0] && <p className={styles.intro}>{region.text[0]}</p>}
          <div className={styles.actions}>
            <Link href={`/runeterra?region=${slug}`} className={buttonClass('primary')}>
              {t.showOnMap}
            </Link>
            <a href="#champions" className={buttonClass('secondary')}>
              {t.champions(champions.length)}
            </a>
          </div>
        </div>
      </section>

      <div className="container">
        {region.text.length > 1 && (
          <section className={styles.story} aria-labelledby="region-story">
            <h2 id="region-story">{t.story}</h2>
            <div className={styles.text}>
              {region.text.slice(1).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </section>
        )}

        {page.galleries.map((g) => (
          <RegionGallery key={g.title} gallery={g} />
        ))}

        <section id="champions" className={styles.section} aria-labelledby="region-champions">
          <h2 id="region-champions">{t.regionChampions}</h2>
          <ul className={styles.champions}>
            {champions.map((c) => {
              const l = lore[c.id];
              return (
                <li key={c.id}>
                  <Link href={championHref(c.slug)} className={styles.champion}>
                    <img src={img.loading(c.id)} alt="" width={308} height={560} loading="lazy" decoding="async" />
                    <span className={styles.championText}>
                      <span className={styles.championName}>{c.name}</span>
                      <span className={styles.championTitle}>{c.title}</span>
                      {l?.quote && <span className={styles.quote}>{t.quote(l.quote)}</span>}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        {tied.length > 0 && (
          <section className={styles.section} aria-labelledby="region-ties">
            <h2 id="region-ties">{t.ties}</h2>
            <p className={styles.lead}>{t.tiesLead}</p>
            <ul className={styles.ties}>
              {tied.map(({ region: r, count }) => (
                <li key={r.slug}>
                  <Link href={`/runeterra/${r.slug}`}>
                    <span>{r.name}</span>
                    <b className="num">{count}</b>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {page.stories.length > 0 && (
          <section className={styles.section} aria-labelledby="region-stories">
            <h2 id="region-stories">{t.stories}</h2>
            <ul className={styles.stories}>
              {page.stories.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noopener">
                    <span>{s.title}</span>
                    <small>{s.kind === 'comic' ? t.comic : t.shortStory}</small>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className={styles.section} aria-labelledby="region-near">
          <h2 id="region-near">{t.neighbors}</h2>
          <ul className={styles.near}>
            {neighbors.map((r) => (
              <li key={r.slug}>
                <Link href={`/runeterra/${r.slug}`} className={styles.nearCard}>
                  {r.image && <img src={r.image} alt="" width={1920} height={888} loading="lazy" decoding="async" />}
                  <span>{r.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <nav className={styles.pager} aria-label={t.otherRegions}>
          <Link href={`/runeterra/${prev.slug}`}>
            <Icon name="chevron-left" size={18} />
            {prev.name}
          </Link>
          <Link href={`/runeterra/${next.slug}`}>
            {next.name}
            <Icon name="chevron-right" size={18} />
          </Link>
        </nav>
      </div>
    </>
  );
}
