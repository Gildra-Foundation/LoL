import type { Metadata } from 'next';
import { ArticleCard } from '@rift/engine/articles/ArticleCard';
import Link from '@rift/engine/i18n/Link';
import { plural } from '@rift/engine/lib/format';
import { ChampionSelect, type SelectChampion } from '@/components/home/ChampionSelect';
import { LolTierPreview } from '@/components/home/LolTierPreview';
import { Frame } from '@rift/engine/ui/Frame';
import { ResourceBar } from '@rift/engine/ui/ResourceBar';
import { getArticles } from '@/lib/articles';
import { championHref, img, PATCH } from '@/lib/assets';
import { difficultyLevel, getChampion, getChampions, leaders, newestChampions, similarChampions, statsOf } from '@/lib/champions';
import { alternates, defineMessages, langOf } from '@/lib/i18n';
import { getRegionsInfo } from '@/lib/lore';
import { MAP_IMAGE } from '@/lib/regions';
import { fmt, fmtStat, type StatKey } from '@/lib/stats';
import styles from './page.module.css';

const RECORDS = [
  { key: 'hp', level: 18 },
  { key: 'ehp_physical', level: 18 },
  { key: 'spellblock', level: 18 },
  { key: 'aa_dps', level: 18 },
  { key: 'attackrange', level: 1 },
  { key: 'movespeed', level: 1 },
] as const satisfies readonly { key: StatKey; level: number }[];

const MESSAGES = defineMessages({
  ru: {
    records: {
      hp: 'Больше всего здоровья на 18 уровне',
      ehp_physical: 'Дольше всех живёт под физическим уроном',
      spellblock: 'Самое высокое сопротивление магии',
      aa_dps: 'Самые сильные автоатаки без предметов',
      attackrange: 'Самая большая дальность атаки',
      movespeed: 'Самый быстрый',
    },
    tierList: 'Тир-лист',
    tierListText: 'Разложите чемпионов по тирам от S до D для своей линии.',
    rankings: 'Рейтинги',
    rankingsText: 'Кто сильнее на 1 и 18 уровне по каждой характеристике.',
    adAt18: 'Сила атаки на 18 уровне',
    compare: 'Сравнение',
    compareText: 'Два чемпиона друг против друга на любом уровне.',
    hpAt18: 'Здоровье на 18 уровне',
    hpAt18Of: (name: string) => `${name}: здоровье на 18 уровне`,
    duel: 'Дуэль',
    duelText: 'Кто кого на одних автоатаках? Живой бой с полосками здоровья и цифрами урона, на любом уровне и против всех чемпионов сразу.',
    versus: (names: string[]) => `${names.join(' или ')}?`,
    guess: 'Угадай чемпиона',
    guessText: 'Загадка дня, одна на всех: угадайте чемпиона по признакам или по кусочку арта.',
    runeterra: 'Рунтерра',
    runeterraText: 'Карта мира League of Legends. Выберите регион — камера подлетит к нему, а рядом откроются его история и чемпионы.',
    regions: (n: number) => `${n} ${plural(n, ['регион', 'региона', 'регионов'], 'ru')}`,
    patchRecords: (patch: string) => `Рекорды патча ${patch}`,
    allRankings: 'Все рейтинги',
    sameValue: (n: number) => `и ещё ${n} с тем же значением`,
    articles: 'Статьи',
    allArticles: 'Все статьи',
  },
  en: {
    records: {
      hp: 'Most health at level 18',
      ehp_physical: 'Survives longest against physical damage',
      spellblock: 'Highest magic resist',
      aa_dps: 'Strongest basic attacks without items',
      attackrange: 'Longest attack range',
      movespeed: 'Fastest',
    },
    tierList: 'Tier list',
    tierListText: 'Sort champions into tiers from S to D for your lane.',
    rankings: 'Rankings',
    rankingsText: 'Who is strongest at levels 1 and 18 in every stat.',
    adAt18: 'Attack damage at level 18',
    compare: 'Compare',
    compareText: 'Two champions head to head at any level.',
    hpAt18: 'Health at level 18',
    hpAt18Of: (name: string) => `${name}: health at level 18`,
    duel: 'Duel',
    duelText: 'Who wins on basic attacks alone? A live fight with health bars and damage numbers, at any level and against every champion at once.',
    versus: (names: string[]) => `${names.join(' or ')}?`,
    guess: 'Guess the champion',
    guessText: 'A daily puzzle, the same for everyone: guess the champion by their traits or by a piece of splash art.',
    runeterra: 'Runeterra',
    runeterraText: 'The world map of League of Legends. Pick a region and the camera flies to it, with its history and champions alongside.',
    regions: (n: number) => `${n} ${plural(n, ['region', 'regions', 'regions'], 'en')}`,
    patchRecords: (patch: string) => `Patch ${patch} records`,
    allRankings: 'All rankings',
    sameValue: (n: number) => `and ${n} more with the same value`,
    articles: 'Articles',
    allArticles: 'All articles',
  },
});

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const lang = await langOf(params);
  return { alternates: alternates(lang, '/') };
}

export default async function Home({ params }: Props) {
  const lang = await langOf(params);
  const t = MESSAGES[lang];
  const champions = getChampions(lang);

  const selectData: SelectChampion[] = champions.map((c) => {
    const at1 = statsOf(c, 1);
    return {
      id: c.id,
      slug: c.slug,
      name: c.name,
      title: c.title,
      tags: c.tags,
      positions: c.positions,
      difficulty: difficultyLevel(c),
      hp1: at1.hp,
      hp18: statsOf(c, 18).hp,
      ad: at1.attackdamage,
      armor: at1.armor,
      mr: at1.spellblock,
      range: at1.attackrange,
      abilities: [
        { key: 'P', name: c.passive.name, file: c.passive.image },
        ...c.spells.map((s) => ({ key: s.key, name: s.name, file: s.image })),
      ],
    };
  });

  const newest = newestChampions(lang, 1)[0];
  const rival = similarChampions(newest, lang, 1)[0];
  const duel = [newest, rival].map((c) => ({ champion: c, hp: statsOf(c, 18).hp }));
  const duelMax = Math.max(...duel.map((d) => d.hp));
  const strongest = leaders('attackdamage', lang, { level: 18, limit: 3 });
  const duelists = [getChampion('Garen', lang), getChampion('Darius', lang)].filter((c) => c !== undefined);

  const records = RECORDS.map((r) => {
    const [top] = leaders(r.key, lang, { level: r.level, limit: 1 });
    const ties = champions.filter((c) => Math.abs(statsOf(c, r.level)[r.key] - top.value) < 1e-6).length - 1;
    return { ...r, label: t.records[r.key], top, ties };
  });

  const articles = getArticles(lang);
  const lead = articles.find((a) => a.featured) ?? articles[0];
  const more = articles.filter((a) => a !== lead).slice(0, 3);

  return (
    <>
      <ChampionSelect champions={selectData} initialId={newest.id} patch={PATCH} />

      <div className="container">
        <div className={styles.sections}>
          <Frame as="article" className={styles.section} innerClassName={styles.sectionInner}>
            <h2>
              <Link href="/tier-list" className={styles.stretched}>
                {t.tierList}
              </Link>
            </h2>
            <p>{t.tierListText}</p>
            <LolTierPreview />
          </Frame>

          <Frame as="article" className={styles.section} innerClassName={styles.sectionInner}>
            <h2>
              <Link href="/stats" className={styles.stretched}>
                {t.rankings}
              </Link>
            </h2>
            <p>{t.rankingsText}</p>
            <div className={styles.board}>
              <span className={styles.caption}>{t.adAt18}</span>
              <ol>
                {strongest.map(({ champion, value }, i) => (
                  <li key={champion.id}>
                    <b className="num">{i + 1}</b>
                    <img src={img.icon(champion.id)} alt="" width={120} height={120} loading="lazy" decoding="async" />
                    <span>{champion.name}</span>
                    <b className="num">{fmtStat('attackdamage', value, lang)}</b>
                  </li>
                ))}
              </ol>
            </div>
          </Frame>

          <Frame as="article" className={styles.section} innerClassName={styles.sectionInner}>
            <h2>
              <Link href={`/compare?a=${newest.slug}&b=${rival.slug}`} className={styles.stretched}>
                {t.compare}
              </Link>
            </h2>
            <p>{t.compareText}</p>
            <div className={styles.duel}>
              <span className={styles.caption}>{t.hpAt18}</span>
              {duel.map(({ champion, hp }, i) => (
                <div key={champion.id} className={styles.side} data-side={i === 0 ? 'ally' : 'enemy'}>
                  <img src={img.icon(champion.id)} alt="" width={120} height={120} loading="lazy" decoding="async" />
                  <span>{champion.name}</span>
                  <b className="num">{fmt(hp, 0, lang)}</b>
                  <ResourceBar
                    value={hp}
                    scaleMax={duelMax}
                    color={i === 0 ? 'var(--ally)' : 'var(--enemy)'}
                    reverse={i === 1}
                    size="sm"
                    label={t.hpAt18Of(champion.name)}
                  />
                </div>
              ))}
            </div>
          </Frame>
        </div>

        <div className={styles.tools}>
          <Frame as="article" className={styles.section} innerClassName={`${styles.sectionInner} ${styles.tool}`}>
            <div className={styles.toolText}>
              <h2>
                <Link href="/duel" className={styles.stretched}>
                  {t.duel}
                </Link>
              </h2>
              <p>{t.duelText}</p>
            </div>
            <div className={styles.versus}>
              {duelists.map((c, i) => (
                <img key={c.id} src={img.tile(c.id)} alt="" width={380} height={380} loading="lazy" decoding="async" data-side={i === 0 ? 'ally' : 'enemy'} />
              ))}
              <span className={styles.vs}>{t.versus(duelists.map((c) => c.name))}</span>
            </div>
          </Frame>

          <Frame as="article" className={styles.section} innerClassName={`${styles.sectionInner} ${styles.tool}`}>
            <div className={styles.toolText}>
              <h2>
                <Link href="/guess" className={styles.stretched}>
                  {t.guess}
                </Link>
              </h2>
              <p>{t.guessText}</p>
            </div>
            <div className={styles.cells} aria-hidden="true">
              {(['match', 'partial', 'miss', 'match', 'miss', 'partial', 'miss'] as const).map((v, i) => (
                <i key={i} data-verdict={v} />
              ))}
            </div>
          </Frame>
        </div>

        <Frame as="article" className={styles.worldFrame} innerClassName={styles.world}>
          <img src={MAP_IMAGE} alt="" width={2048} height={2048} loading="lazy" decoding="async" className={styles.worldMap} />
          <div className={styles.worldText}>
            <h2>
              <Link href="/runeterra" className={styles.stretched}>
                {t.runeterra}
              </Link>
            </h2>
            <p>{t.runeterraText}</p>
            <p className={styles.worldMeta}>{t.regions(getRegionsInfo(lang).regions.length)}</p>
          </div>
        </Frame>

        <section className={styles.block}>
          <div className={styles.head}>
            <h2>{t.patchRecords(PATCH)}</h2>
            <Link href="/stats" className={styles.more}>
              {t.allRankings}
            </Link>
          </div>
          <ul className={styles.records}>
            {records.map(({ key, label, top, ties }) => (
              <li key={key}>
                <Frame as="article" className={styles.record} innerClassName={styles.recordInner}>
                  <img src={img.tile(top.champion.id)} alt="" width={380} height={380} loading="lazy" decoding="async" />
                  <h3>{label}</h3>
                  <p className={`num ${styles.value}`}>{fmtStat(key, top.value, lang)}</p>
                  <p className={styles.who}>
                    <Link href={championHref(top.champion.slug)} className={styles.stretched}>
                      {top.champion.name}
                    </Link>
                    {ties > 0 && <span>{t.sameValue(ties)}</span>}
                  </p>
                </Frame>
              </li>
            ))}
          </ul>
        </section>

        {lead && (
          <section className={styles.block}>
            <div className={styles.head}>
              <h2>{t.articles}</h2>
              <Link href="/articles" className={styles.more}>
                {t.allArticles}
              </Link>
            </div>
            <ArticleCard article={lead} lead />
            <div className={styles.articles}>
              {more.map((a) => (
                <ArticleCard key={a.slug} article={a} />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
