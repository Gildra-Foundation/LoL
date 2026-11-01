import type { Metadata } from 'next';
import Link from '@rift/engine/i18n/Link';
import { notFound } from 'next/navigation';
import { JsonLd } from '@/components/seo/JsonLd';
import { Icon } from '@/components/Icon';
import { SkinGrid } from '@/components/skins/SkinCard';
import { SkinMedia } from '@/components/skins/SkinMedia';
import { SkinViewer } from '@/components/skins/SkinViewer';
import { Tag } from '@rift/engine/ui/Tag';
import { formatDate, plural } from '@rift/engine/lib/format';
import { championHref } from '@/lib/assets';
import { getChampion } from '@/lib/champions';
import { DEFAULT_LOCALE, alternates, defineMessages, langOf, ogLocale, type Locale } from '@/lib/i18n';
import { RARITIES } from '@/lib/labels';
import { breadcrumbData } from '@/lib/seo';
import { cdAsset, lineHref, rarityHref, skinHref, universeHref } from '@/lib/skin-assets';
import { AVAILABILITY, COST_NOTE, NEW_FEATURES } from '@/lib/skin-labels';
import { getLine, getSkin, getSkinBySlug, getSkins, getUniverse, skinsOfChampion, skinsOfLine, type Skin } from '@/lib/skins';
import styles from '../skins.module.css';

const MESSAGES = defineMessages({
  ru: {
    metaTitle: (name: string) => `${name}: сплэш-арт, хромы, цена`,
    metaDescription: (name: string, champion: string, rarity: string, chromas: number) =>
      `Образ ${name} для чемпиона ${champion} в League of Legends: ${rarity.toLowerCase()}, сплэш-арт, экран загрузки${chromas ? `, ${chromas} ${plural(chromas, ['хрома', 'хромы', 'хром'], 'ru')}` : ''}, цена и дата выхода.`,
    skins: 'Образы',
    champion: 'Чемпион',
    base: 'Базовый образ',
    standard: 'Обычный',
    legacy: 'Наследие',
    facts: 'Сведения',
    rarity: 'Редкость',
    price: 'Цена',
    rp: (n: number) => `${n} RP`,
    released: 'Вышел',
    availability: 'Доступность',
    line: 'Набор',
    universe: 'Тематика',
    voice: 'Озвучка',
    artist: 'Художник сплэш-арта',
    whatsNew: 'Что нового',
    features: 'Особенности',
    stages: 'Ступени образа',
    stage: (n: number) => `Ступень ${n}`,
    previews: 'Умения в образе',
    sameLine: (line: string) => `Ещё из набора «${line}»`,
    sameChampion: (champion: string) => `Другие образы: ${champion}`,
    allOfChampion: (n: number) => `Все ${n} ${plural(n, ['образ', 'образа', 'образов'], 'ru')}`,
    music: 'Тема образа',
    source: 'Цена, дата и авторы — League of Legends Wiki (CC BY-SA).',
    crumbs: 'Навигация',
  },
  en: {
    metaTitle: (name: string) => `${name}: splash art, chromas, price`,
    metaDescription: (name: string, champion: string, rarity: string, chromas: number) =>
      `${name}, a League of Legends skin for ${champion}: ${rarity.toLowerCase()}, splash art, loading screen${chromas ? `, ${chromas} ${plural(chromas, ['chroma', 'chromas', 'chromas'], 'en')}` : ''}, price and release date.`,
    skins: 'Skins',
    champion: 'Champion',
    base: 'Base skin',
    standard: 'Standard',
    legacy: 'Legacy',
    facts: 'Details',
    rarity: 'Rarity',
    price: 'Price',
    rp: (n: number) => `${n} RP`,
    released: 'Released',
    availability: 'Availability',
    line: 'Skin line',
    universe: 'Universe',
    voice: 'Voice',
    artist: 'Splash artist',
    whatsNew: 'What is new',
    features: 'Features',
    stages: 'Skin stages',
    stage: (n: number) => `Stage ${n}`,
    previews: 'Abilities in this skin',
    sameLine: (line: string) => `More from ${line}`,
    sameChampion: (champion: string) => `Other ${champion} skins`,
    allOfChampion: (n: number) => `All ${n} skins`,
    music: 'Skin theme',
    source: 'Price, date and credits: League of Legends Wiki (CC BY-SA).',
    crumbs: 'Breadcrumbs',
  },
});

export const dynamicParams = false;

export function generateStaticParams() {
  return getSkins(DEFAULT_LOCALE).map((s) => ({ slug: s.slug }));
}

type Params = { params: Promise<{ lang: string; slug: string }> };

const rarityLabel = (s: Skin, lang: Locale) => (s.rarity ? RARITIES[lang][s.rarity].label : s.base ? MESSAGES[lang].base : MESSAGES[lang].standard);

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const lang = await langOf(params);
  const s = getSkinBySlug(slug, lang);
  if (!s) return {};
  const champion = getChampion(s.champion, lang)!;
  return {
    title: MESSAGES[lang].metaTitle(s.name),
    description: MESSAGES[lang].metaDescription(s.name, champion.name, rarityLabel(s, lang), s.chromas.length),
    alternates: alternates(lang, skinHref(s.slug)),
    openGraph: { images: s.images.splash ? [cdAsset(s.images.splash)] : [], ...ogLocale(lang) },
  };
}

const lite = (s: Skin, lang: Locale) => ({
  id: s.id,
  slug: s.slug,
  name: s.name,
  championName: getChampion(s.champion, lang)?.name ?? s.champion,
  rarity: s.rarity,
  loading: s.images.loading,
  cost: s.cost ?? null,
  chromas: s.chromas.length,
});

export default async function SkinPage({ params }: Params) {
  const { slug } = await params;
  const lang = await langOf(params);
  const s = getSkinBySlug(slug, lang);
  if (!s) notFound();
  const t = MESSAGES[lang];
  const champion = getChampion(s.champion, lang)!;
  const rarity = s.rarity ? RARITIES[lang][s.rarity] : null;
  const lines = s.lines.map((id) => getLine(id, lang)).filter((l) => l !== undefined);
  const universes = s.universes.map((id) => getUniverse(id, lang)).filter((u) => u !== undefined);
  const stages = (s.stages ?? (s.parent ? getSkin(s.parent, lang)?.stages : null) ?? []).map((id) => getSkin(id, lang)).filter((x) => x !== undefined);
  const championSkins = skinsOfChampion(s.champion, lang);
  const sameChampion = championSkins.filter((x) => x.id !== s.id && !x.base).slice(-12).reverse();
  const sameLine = lines[0] ? skinsOfLine(lines[0].id, lang).filter((x) => x.id !== s.id).slice(0, 12) : [];
  const newFeatures = s.new ? (Object.keys(NEW_FEATURES[lang]) as (keyof typeof NEW_FEATURES.ru)[]).filter((k) => s.new![k]) : [];

  const price = s.cost ? t.rp(s.cost) : s.costNote ? COST_NOTE[lang][s.costNote] : null;
  const facts = [
    { label: t.champion, value: <Link href={championHref(champion.slug)}>{champion.name}</Link> },
    { label: t.rarity, value: rarity ? <Link href={rarityHref(s.rarity!)}>{rarity.label}</Link> : rarityLabel(s, lang) },
    ...(price ? [{ label: t.price, value: price }] : []),
    ...(s.release ? [{ label: t.released, value: formatDate(new Date(s.release), lang) }] : []),
    ...(s.availability ? [{ label: t.availability, value: AVAILABILITY[lang][s.availability] ?? s.availability }] : []),
    ...lines.map((l) => ({ label: t.line, value: <Link href={lineHref(l.slug)}>{l.name}</Link> })),
    ...universes.map((u) => ({ label: t.universe, value: <Link href={universeHref(u.slug)}>{u.name}</Link> })),
    ...(s.voiceActors?.length ? [{ label: t.voice, value: s.voiceActors.join(', ') }] : []),
    ...(s.splashArtists?.length ? [{ label: t.artist, value: s.splashArtists.join(', ') }] : []),
  ];

  return (
    <div>
      <JsonLd
        data={breadcrumbData(lang, [
          { name: t.skins, path: '/skins' },
          { name: champion.name, path: `/skins?champion=${champion.slug}` },
          { name: s.name, path: skinHref(s.slug) },
        ])}
      />
      <section className={`${styles.hero} ${styles.heroCompact}`}>
        {s.images.splash && (
          <div className={`${styles.heroBg} ${styles.heroBlur}`} aria-hidden="true">
            <img src={cdAsset(s.images.splash)} alt="" width={1280} height={720} fetchPriority="high" />
          </div>
        )}
        <div className={`container ${styles.heroContent}`}>
          <nav className={styles.crumbs} aria-label={t.crumbs}>
            <Link href="/skins">{t.skins}</Link>
            <Icon name="chevron-right" size={14} />
            <Link href={`/skins?champion=${champion.slug}`}>{champion.name}</Link>
          </nav>
          <h1 className={styles.title}>{s.name}</h1>
          <div className={styles.tags}>
            {rarity && (
              <Tag href={rarityHref(s.rarity!)} color={rarity.color} icon={<span className={styles.gem} />}>
                {rarity.label}
              </Tag>
            )}
            {s.legacy && <Tag>{t.legacy}</Tag>}
            {lines.map((l) => (
              <Tag key={l.id} href={lineHref(l.slug)}>
                {l.name}
              </Tag>
            ))}
          </div>
        </div>
      </section>

      <div className={`container ${styles.layout}`}>
        <div className={styles.main}>
          <SkinViewer
            name={s.name}
            images={{ splash: s.images.splash, uncentered: s.images.uncentered, loading: s.images.loading, vintage: s.images.vintage }}
            chromas={s.chromas}
            animated={s.video.splash}
          />
          <SkinMedia id={s.id} chromas={s.chromas} />
          {s.description && <p className={styles.description}>{s.description}</p>}
          {s.features.length > 0 && (
            <section className={styles.sub}>
              <h2 className={styles.h3}>{t.features}</h2>
              <ul className={styles.bullets}>
                {s.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </section>
          )}
          {s.video.features.length > 0 && (
            <section className={styles.sub}>
              <h2 className={styles.h3}>{t.previews}</h2>
              <ul className={styles.clips} role="list">
                {s.video.features.map((f) => (
                  <li key={f.video}>
                    <video src={cdAsset(f.video)} muted loop playsInline controls preload="none" aria-label={f.name} />
                    <b>{f.name}</b>
                    {f.text && <span>{f.text}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className={styles.side}>
          <h2 className={styles.h3}>{t.facts}</h2>
          <dl className={styles.facts}>
            {facts.map((f, i) => (
              <div key={i}>
                <dt>{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
          {newFeatures.length > 0 && (
            <>
              <h3 className={styles.h4}>{t.whatsNew}</h3>
              <ul className={styles.chips} role="list">
                {newFeatures.map((k) => (
                  <li key={k}>{NEW_FEATURES[lang][k]}</li>
                ))}
              </ul>
            </>
          )}
          {s.music && (
            <p className={styles.muted}>
              <a href={`https://www.youtube.com/watch?v=${s.music}`} target="_blank" rel="noopener">
                <Icon name="play" size={14} /> {t.music}
              </a>
            </p>
          )}
          {s.availability && <p className={styles.note}>{t.source}</p>}
        </aside>
      </div>

      <div className="container">
        {stages.length > 1 && (
          <section className={styles.block}>
            <h2 className={styles.h2}>{t.stages}</h2>
            <SkinGrid skins={stages.map((x) => lite(x, lang))} lang={lang} />
          </section>
        )}
        {sameLine.length > 0 && (
          <section className={styles.block}>
            <div className={styles.blockHead}>
              <h2 className={styles.h2}>{t.sameLine(lines[0].name)}</h2>
              <Link href={lineHref(lines[0].slug)} className={styles.all}>
                {lines[0].count} <Icon name="chevron-right" size={14} />
              </Link>
            </div>
            <SkinGrid skins={sameLine.map((x) => lite(x, lang))} lang={lang} />
          </section>
        )}
        {sameChampion.length > 0 && (
          <section className={styles.block}>
            <div className={styles.blockHead}>
              <h2 className={styles.h2}>{t.sameChampion(champion.name)}</h2>
              <Link href={`/skins?champion=${champion.slug}`} className={styles.all}>
                {t.allOfChampion(championSkins.length - 1)} <Icon name="chevron-right" size={14} />
              </Link>
            </div>
            <SkinGrid skins={sameChampion.map((x) => lite(x, lang))} lang={lang} />
          </section>
        )}
      </div>
    </div>
  );
}
