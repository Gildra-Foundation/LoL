import type { Metadata } from 'next';
import Link from '@rift/engine/i18n/Link';
import { notFound } from 'next/navigation';
import { ViewTransition } from 'react';
import { ArticleCard } from '@rift/engine/articles/ArticleCard';
import { AbilitiesSection, type AbilityFull } from '@/components/champion/AbilitiesSection';
import { ChampionChip } from '@/components/champion/ChampionChip';
import { ChampionProvider } from '@/components/champion/ChampionProvider';
import { DockedHud } from '@/components/champion/DockedHud';
import { HeroHud, type HudData } from '@/components/champion/HeroHud';
import { LaneMap } from '@/components/champion/LaneMap';
import { SkinGallery, type SkinData } from '@/components/champion/SkinGallery';
import { StatsSection, type StatRowData } from '@/components/champion/StatsSection';
import { Frame } from '@rift/engine/ui/Frame';
import { Icon } from '@/components/Icon';
import { Radar } from '@rift/engine/ui/Radar';
import { Tag } from '@rift/engine/ui/Tag';
import { getArticles } from '@/lib/articles';
import { getLore, regionOf, relations } from '@/lib/lore';
import { PATCH, abilityVideo, championHref, img } from '@/lib/assets';
import {
  difficultyLevel,
  getChampion,
  getChampionBySlug,
  getChampions,
  hasRatings,
  similarChampions,
  statSeries,
  type Champion,
} from '@/lib/champions';
import { formatDate, plural } from '@rift/engine/lib/format';
import { DEFAULT_LOCALE, LOCALE_TAG, alternates, defineMessages, langOf, ogLocale, type Locale } from '@/lib/i18n';
import { ATTACK_TYPES, CLASSES, DAMAGE_TYPES, DIFFICULTY, PLAYSTYLE_AXES, RARITIES, resourceColor } from '@/lib/labels';
import { STATS, fmt, fmtGrowth, fmtStat, type StatKey } from '@/lib/stats';
import styles from './page.module.css';

const MESSAGES = defineMessages({
  ru: {
    metaTitle: (name: string) => `${name}: характеристики, умения, образы`,
    metaDescription: (name: string, title: string, skins: number, patch: string) =>
      `${name}, ${title.toLowerCase()}. Здоровье, урон и защита на каждом уровне, место среди всех чемпионов, умения с перезарядкой по рангам и ${skins} образов. Патч ${patch}.`,
    self: 'на себя',
    global: 'вся карта',
    resourceRegen: 'Восстановление ресурса',
    per5: (label: string) => `${label}, за 5 с`,
    growth: (base: string, growth: string) => `${base}, ${growth} за уровень`,
    noGrowth: (base: string) => `${base}, не растёт`,
    attack: 'Атака',
    attackValue: (type: string, range: number) => `${type}, дальность ${range}`,
    range: (range: number) => `Дальность ${range}`,
    mainDamage: 'Основной урон',
    noData: 'нет данных',
    resource: 'Ресурс',
    none: 'нет',
    difficulty: 'Сложность',
    outOf10: (n: number) => `${n} из 10`,
    released: 'В игре с',
    skins: 'Образы',
    skinCount: (n: number) => `${n} ${plural(n, ['образ', 'образа', 'образов'], 'ru')}`,
    defense: 'Защита',
    magic: 'Магия',
    crumbs: 'Навигация',
    champions: 'Чемпионы',
    regionTitle: 'Регион на карте Рунтерры',
    damage: (type: string) => `${type} урон`,
    difficultyTag: (level: string) => `Сложность: ${level}`,
    build: 'Собрать билд',
    statsLabel: 'Характеристики',
    abilitiesLabel: 'Умения',
    skinsLead: (count: string) => `${count} и базовый. Цвет полоски под названием — редкость образа.`,
    tips: 'Подсказки из клиента',
    playingAs: (name: string) => `Если играете за ${name}`,
    playingAgainst: 'Если играете против',
    profile: 'Профиль',
    positions: 'Где играют',
    noPositions: 'Для новых чемпионов позиции появляются с задержкой: источник данных ещё не обновился.',
    playstyle: 'Стиль игры',
    playstyleNote: 'Оценки Riot от 1 до 3',
    summary: 'Коротко',
    story: 'История и связи',
    stories: 'Рассказы и комиксы',
    readTime: (minutes: number) => `${minutes} мин чтения на Universe`,
    onUniverse: 'На сайте Universe',
    homeland: 'Родина',
    race: 'Раса',
    related: 'Связанные чемпионы',
    noHomeland: 'Без родины',
    regionMap: 'Связи региона на карте',
    similar: 'Похожие по цифрам',
    similarLead: 'Близкие базовые характеристики и рост, тот же класс и тип атаки.',
    articles: (name: string) => `Статьи, где есть ${name}`,
    neighbors: 'Соседние чемпионы',
    prev: 'Предыдущий',
    next: 'Следующий',
  },
  en: {
    metaTitle: (name: string) => `${name}: stats, abilities, skins`,
    metaDescription: (name: string, title: string, skins: number, patch: string) =>
      `${name}, ${title}. Health, damage and defense at every level, rank among all champions, abilities with cooldowns by rank and ${skins} ${plural(skins, ['skin', 'skins', 'skins'], 'en')}. Patch ${patch}.`,
    self: 'self',
    global: 'global',
    resourceRegen: 'Resource regen',
    per5: (label: string) => `${label} per 5 s`,
    growth: (base: string, growth: string) => `${base}, ${growth} per level`,
    noGrowth: (base: string) => `${base}, no growth`,
    attack: 'Attack',
    attackValue: (type: string, range: number) => `${type}, range ${range}`,
    range: (range: number) => `Range ${range}`,
    mainDamage: 'Primary damage',
    noData: 'no data',
    resource: 'Resource',
    none: 'none',
    difficulty: 'Difficulty',
    outOf10: (n: number) => `${n} out of 10`,
    released: 'Released',
    skins: 'Skins',
    skinCount: (n: number) => `${n} ${plural(n, ['skin', 'skins', 'skins'], 'en')}`,
    defense: 'Defense',
    magic: 'Magic',
    crumbs: 'Breadcrumbs',
    champions: 'Champions',
    regionTitle: 'Region on the Runeterra map',
    damage: (type: string) => `${type} damage`,
    difficultyTag: (level: string) => `Difficulty: ${level}`,
    build: 'Create a build',
    statsLabel: 'Stats',
    abilitiesLabel: 'Abilities',
    skinsLead: (count: string) => `${count} plus the base one. The color of the bar under the name shows the skin's rarity.`,
    tips: 'Tips from the client',
    playingAs: (name: string) => `Playing as ${name}`,
    playingAgainst: 'Playing against',
    profile: 'Profile',
    positions: 'Positions',
    noPositions: "Positions for new champions show up with a delay: the data source hasn't updated yet.",
    playstyle: 'Playstyle',
    playstyleNote: 'Riot ratings from 1 to 3',
    summary: 'At a glance',
    story: 'Lore and connections',
    stories: 'Stories and comics',
    readTime: (minutes: number) => `${minutes} min read on Universe`,
    onUniverse: 'On Universe',
    homeland: 'Homeland',
    race: 'Race',
    related: 'Related champions',
    noHomeland: 'No homeland',
    regionMap: 'Region connections on the map',
    similar: 'Similar by the numbers',
    similarLead: 'Close base stats and growth, same class and attack type.',
    articles: (name: string) => `Articles featuring ${name}`,
    neighbors: 'Previous and next champions',
    prev: 'Previous',
    next: 'Next',
  },
});

export const dynamicParams = false;

export function generateStaticParams() {
  return getChampions(DEFAULT_LOCALE).map((c) => ({ slug: c.slug }));
}

type Params = { params: Promise<{ lang: string; slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const lang = await langOf(params);
  const c = getChampionBySlug(slug, lang);
  if (!c) return {};
  const t = MESSAGES[lang];
  return {
    title: t.metaTitle(c.name),
    description: t.metaDescription(c.name, c.title, c.skins.length - 1, PATCH),
    alternates: alternates(lang, championHref(c.slug)),
    openGraph: { images: [img.centered(c.id)], ...ogLocale(lang) },
  };
}

const MAIN_KEYS: StatKey[] = ['hp', 'hpregen', 'mp', 'mpregen', 'attackdamage', 'attackspeed', 'armor', 'spellblock', 'movespeed', 'attackrange'];
const DERIVED_KEYS: StatKey[] = ['ehp_physical', 'ehp_magic', 'aa_dps'];

function rangeText(range: number[] | null, lang: Locale) {
  const t = MESSAGES[lang];
  if (!range || range.every((v) => v <= 1)) return t.self;
  if (range.every((v) => v >= 20000)) return t.global;
  const uniq = [...new Set(range)];
  return uniq.length === 1 ? fmt(uniq[0], 0, lang) : range.map((v) => fmt(v, 0, lang)).join(' / ');
}

function statRow(c: Champion, key: StatKey, lang: Locale): StatRowData {
  const t = MESSAGES[lang];
  const def = STATS[lang][key];
  const regen = key === 'hpregen' || key === 'mpregen';
  let label = def.label;
  if (key === 'mp') label = c.partype;
  if (key === 'mpregen') label = t.resourceRegen;
  if (regen) label = t.per5(label);
  if (!def.base) return { key, label: def.short, base: def.hint ?? '' };
  const base = c.stats[def.base] ?? 0;
  const growth = def.growth ? (c.stats[def.growth] ?? 0) : 0;
  return { key, label, base: growth ? t.growth(fmtStat(key, base, lang), fmtGrowth(def, growth, lang)) : t.noGrowth(fmtStat(key, base, lang)) };
}

export default async function ChampionPage({ params }: Params) {
  const { slug } = await params;
  const lang = await langOf(params);
  const t = MESSAGES[lang];
  const c = getChampionBySlug(slug, lang);
  if (!c) notFound();

  const champions = getChampions(lang);
  const index = champions.indexOf(c);
  const prev = champions[(index - 1 + champions.length) % champions.length];
  const next = champions[(index + 1) % champions.length];
  const series = statSeries(c);
  const hasResource = c.stats.mp > 0;
  const cls = CLASSES[lang][c.tags[0]];
  const diff = difficultyLevel(c);

  const abilities: AbilityFull[] = [
    {
      key: 'P',
      name: c.passive.name,
      icon: img.passive(c.passive.image),
      description: c.passive.description,
      video: c.passive.video ? abilityVideo(c.passive.video) : null,
      cooldown: [],
      costText: '',
      rangeText: '',
      maxrank: 1,
    },
    ...c.spells.map((s) => ({
      key: s.key,
      name: s.name,
      icon: img.spell(s.image),
      description: s.description,
      video: s.video ? abilityVideo(s.video) : null,
      cooldown: s.cooldown,
      costText: s.costText,
      rangeText: rangeText(s.range, lang),
      maxrank: s.maxrank,
    })),
  ];

  const hud: HudData = {
    id: c.id,
    name: c.name,
    portrait: img.icon(c.id),
    partype: c.partype,
    resourceColor: resourceColor(c.resource),
    hasResource,
    series,
    abilities: abilities.map(({ key, name, icon }) => ({ key, name, icon })),
  };

  const rows = MAIN_KEYS.filter((k) => hasResource || (k !== 'mp' && k !== 'mpregen')).map((k) => statRow(c, k, lang));
  const derived = DERIVED_KEYS.map((k) => statRow(c, k, lang));

  const skins: SkinData[] = c.skins.map((s) => ({
    num: s.num,
    name: s.name,
    loading: img.loading(c.id, s.num),
    splash: img.splash(c.id, s.num),
    rarity: s.rarity ? (RARITIES[lang][s.rarity] ?? null) : null,
    legacy: s.legacy,
    chromas: s.chromas,
  }));

  const similar = similarChampions(c, lang, 6);
  const region = regionOf(c.id, lang);
  // лор из Universe: цитата, связи, рассказы; текст — что длиннее, Universe или Data Dragon
  const story = getLore(lang)[c.id];
  const bio = story && story.bio.join(' ').length >= c.lore.length ? story.bio : [c.lore].filter(Boolean);
  const known = (relations[c.id] ?? [])
    .map((id) => getChampion(id, lang))
    .filter((k): k is Champion => k !== undefined)
    .map((k) => ({ champion: k, home: regionOf(k.id, lang) }))
    // сначала земляки, потом остальные по алфавиту
    .sort((a, b) => Number(a.home !== region) - Number(b.home !== region) || a.champion.name.localeCompare(b.champion.name, LOCALE_TAG[lang]));
  const related = getArticles(lang)
    .filter((a) => a.champions.includes(c.id) || a.cover.champion === c.id)
    .slice(0, 3);

  const skinCount = c.skins.length - 1;
  const facts = [
    { label: t.attack, value: c.tactical ? t.attackValue(ATTACK_TYPES[lang][c.tactical.attackType], c.stats.attackrange) : t.range(c.stats.attackrange) },
    { label: t.mainDamage, value: c.tactical ? DAMAGE_TYPES[lang][c.tactical.damageType] : t.noData },
    { label: t.resource, value: c.resource === 'none' ? t.none : c.partype },
    { label: t.difficulty, value: `${DIFFICULTY[lang][diff]}${c.info.difficulty ? `, ${t.outOf10(c.info.difficulty)}` : ''}` },
    ...(c.releaseDate ? [{ label: t.released, value: formatDate(new Date(c.releaseDate), lang) }] : []),
    { label: t.skins, value: t.skinCount(skinCount) },
  ];

  const ratings = [
    { label: t.attack, value: c.info.attack, color: 'var(--stat-ad)' },
    { label: t.defense, value: c.info.defense, color: 'var(--health)' },
    { label: t.magic, value: c.info.magic, color: 'var(--stat-mr)' },
    { label: t.difficulty, value: c.info.difficulty, color: 'var(--bone)' },
  ];

  return (
    <ViewTransition
      key={c.slug}
      name="champion-page"
      share={{ 'nav-forward': 'nav-forward', 'nav-back': 'nav-back', default: 'auto' }}
      enter={{ 'nav-forward': 'nav-forward', 'nav-back': 'nav-back', default: 'none' }}
      exit={{ 'nav-forward': 'nav-forward', 'nav-back': 'nav-back', default: 'none' }}
      default="none"
    >
      <div>
        <ChampionProvider>
          <section className={styles.hero}>
            <div className={styles.heroBg} aria-hidden="true">
              <img src={img.centered(c.id)} alt="" width={1280} height={720} fetchPriority="high" />
            </div>
            <div className={`container ${styles.heroContent}`}>
              <nav className={styles.crumbs} aria-label={t.crumbs}>
                <Link href="/champions" transitionTypes={['nav-back']}>
                  {t.champions}
                </Link>
                <Icon name="chevron-right" size={14} />
                <span aria-current="page">{c.name}</span>
              </nav>
              <h1 className={styles.name}>{c.name}</h1>
              <p className={styles.title}>{c.title}</p>
              <div className={styles.tags}>
                {region && (
                  <Tag href={`/runeterra?region=${region.slug}`} title={t.regionTitle}>
                    {region.name}
                  </Tag>
                )}
                {c.tags.map((tag) => (
                  <Tag key={tag} icon={<Icon name={tag} size={15} />} color={`var(--cls-${tag})`} href={`/champions?class=${tag.toLowerCase()}`}>
                    {CLASSES[lang][tag].label}
                  </Tag>
                ))}
                {c.tactical && <Tag>{ATTACK_TYPES[lang][c.tactical.attackType]}</Tag>}
                {c.tactical && <Tag>{t.damage(DAMAGE_TYPES[lang][c.tactical.damageType])}</Tag>}
                <Tag title={c.info.difficulty ? `Riot: ${t.outOf10(c.info.difficulty)}` : undefined}>{t.difficultyTag(DIFFICULTY[lang][diff].toLowerCase())}</Tag>
                <Tag href={`/builds?c=${c.slug}${c.positions[0] ? `&lane=${c.positions[0].toLowerCase()}` : ''}`} icon={<Icon name="sliders" size={15} />} color="var(--ally)">
                  {t.build}
                </Tag>
              </div>
              <HeroHud data={hud} />
            </div>
          </section>

          <div className="container">
            <section id="stats" className={styles.block} aria-label={t.statsLabel}>
              <StatsSection name={c.name} total={champions.length} among={cls.among} series={series} rows={rows} derived={derived} />
            </section>
            <section id="abilities" className={styles.block} aria-label={t.abilitiesLabel}>
              <AbilitiesSection abilities={abilities} />
            </section>
          </div>

          <DockedHud data={hud} />
        </ChampionProvider>

        <div className="container">
          <section id="skins" className={styles.block}>
            <h2 className={styles.h2}>{t.skins}</h2>
            <p className={styles.lead}>{t.skinsLead(t.skinCount(skinCount))}</p>
            <SkinGallery skins={skins} />
          </section>

          {(c.allytips.length > 0 || c.enemytips.length > 0) && (
            <section id="tips" className={styles.block}>
              <h2 className={styles.h2}>{t.tips}</h2>
              <div className={styles.tips}>
                {c.allytips.length > 0 && (
                  <Frame tone="ally" innerClassName={styles.tipBody}>
                    <h3>{t.playingAs(c.name)}</h3>
                    <ul>
                      {c.allytips.map((tip) => (
                        <li key={tip}>{tip}</li>
                      ))}
                    </ul>
                  </Frame>
                )}
                {c.enemytips.length > 0 && (
                  <Frame tone="enemy" innerClassName={styles.tipBody}>
                    <h3>{t.playingAgainst}</h3>
                    <ul>
                      {c.enemytips.map((tip) => (
                        <li key={tip}>{tip}</li>
                      ))}
                    </ul>
                  </Frame>
                )}
              </div>
            </section>
          )}

          <section id="profile" className={styles.block}>
            <h2 className={styles.h2}>{t.profile}</h2>
            <div className={styles.profile}>
              <div className={styles.card}>
                <h3>{t.positions}</h3>
                {c.positions.length > 0 ? (
                  <LaneMap positions={c.positions} />
                ) : (
                  <p className={styles.muted}>{t.noPositions}</p>
                )}
              </div>
              {c.playstyle && (
                <div className={styles.card}>
                  <h3>{t.playstyle}</h3>
                  <p className={styles.muted}>{t.playstyleNote}</p>
                  <Radar axes={PLAYSTYLE_AXES[lang].map(([, l]) => l)} series={[{ label: c.name, color: 'var(--health)', values: PLAYSTYLE_AXES[lang].map(([k]) => c.playstyle![k]) }]} />
                </div>
              )}
              <div className={styles.card}>
                <h3>{t.summary}</h3>
                <dl className={styles.facts}>
                  {facts.map((f) => (
                    <div key={f.label}>
                      <dt>{f.label}</dt>
                      <dd>{f.value}</dd>
                    </div>
                  ))}
                </dl>
                {hasRatings(c) && (
                  <div className={styles.ratings}>
                    {ratings.map((r) => (
                      <div key={r.label} className={styles.rating} style={{ '--accent': r.color } as React.CSSProperties}>
                        <span>{r.label}</span>
                        <span className={styles.segments} aria-hidden="true">
                          {Array.from({ length: 10 }, (_, n) => (
                            <i key={n} className={n < r.value ? styles.segOn : undefined} />
                          ))}
                        </span>
                        <span className="num">{r.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          {(bio.length > 0 || known.length > 0) && (
            <section id="story" className={styles.block}>
              <h2 className={styles.h2}>{t.story}</h2>
              <div className={styles.story}>
                <div>
                  {story?.quote && (
                    <figure className={styles.quote}>
                      <blockquote>
                        <p>{story.quote}</p>
                      </blockquote>
                      {story.quoteAuthor && <figcaption>{story.quoteAuthor}</figcaption>}
                    </figure>
                  )}
                  <div className={styles.bio}>
                    {bio.map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                  </div>
                  {story && story.stories.length > 0 && (
                    <>
                      <h3 className={styles.h3}>{t.stories}</h3>
                      <ul className={styles.stories}>
                        {story.stories.map((st) => (
                          <li key={st.url}>
                            <a href={st.url} target="_blank" rel="noopener">
                              <span>{st.title}</span>
                              <small>{st.minutes ? t.readTime(st.minutes) : t.onUniverse}</small>
                            </a>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
                <aside className={styles.storySide}>
                  {region && (
                    <Link href={`/runeterra/${region.slug}`} className={styles.homeland}>
                      {region.image && <img src={region.image} alt="" width={1920} height={888} loading="lazy" decoding="async" />}
                      <span>
                        <small>{t.homeland}</small>
                        {region.name}
                      </span>
                    </Link>
                  )}
                  {story && story.races.length > 0 && (
                    <p className={styles.races}>
                      {t.race} <b>{story.races.join(', ')}</b>
                    </p>
                  )}
                  {known.length > 0 && (
                    <>
                      <h3 className={styles.h3}>{t.related}</h3>
                      <ul className={styles.known}>
                        {known.map(({ champion: k, home }) => (
                          <li key={k.id}>
                            <Link href={championHref(k.slug)}>
                              <img src={img.icon(k.id)} alt="" width={48} height={48} loading="lazy" />
                              <span>
                                <b>{k.name}</b>
                                <small>{home ? home.name : t.noHomeland}</small>
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                      {region && (
                        <Link href={`/runeterra?region=${region.slug}`} className={styles.mapLink}>
                          {t.regionMap}
                          <Icon name="chevron-right" size={16} />
                        </Link>
                      )}
                    </>
                  )}
                </aside>
              </div>
            </section>
          )}

          <section id="similar" className={styles.block}>
            <h2 className={styles.h2}>{t.similar}</h2>
            <p className={styles.lead}>{t.similarLead}</p>
            <div className={styles.chips}>
              {similar.map((s) => (
                <ChampionChip key={s.id} id={s.id} slug={s.slug} name={s.name} tags={s.tags} />
              ))}
            </div>
          </section>

          {related.length > 0 && (
            <section className={styles.block}>
              <h2 className={styles.h2}>{t.articles(c.name)}</h2>
              <div className={styles.articles}>
                {related.map((a) => (
                  <ArticleCard key={a.slug} article={a} />
                ))}
              </div>
            </section>
          )}

          <nav className={styles.pager} aria-label={t.neighbors}>
            <Link href={championHref(prev.slug)} transitionTypes={['nav-back']} className={styles.pagerLink}>
              <Icon name="chevron-left" size={20} />
              <img src={img.icon(prev.id)} alt="" width={44} height={44} loading="lazy" />
              <span>
                <small>{t.prev}</small>
                {prev.name}
              </span>
            </Link>
            <Link href={championHref(next.slug)} transitionTypes={['nav-forward']} className={`${styles.pagerLink} ${styles.pagerNext}`}>
              <span>
                <small>{t.next}</small>
                {next.name}
              </span>
              <img src={img.icon(next.id)} alt="" width={44} height={44} loading="lazy" />
              <Icon name="chevron-right" size={20} />
            </Link>
          </nav>
        </div>
      </div>
    </ViewTransition>
  );
}
