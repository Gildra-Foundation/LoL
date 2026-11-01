import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from '@rift/engine/i18n/Link';
import { PageHead } from '@rift/engine/ui/PageHead';
import { Tag } from '@rift/engine/ui/Tag';
import { SkinCatalog } from '@/components/skins/SkinCatalog';
import { getChampions } from '@/lib/champions';
import { alternates, defineMessages, langOf } from '@/lib/i18n';
import { RARITIES } from '@/lib/labels';
import { rarityHref, universeHref } from '@/lib/skin-assets';
import { SKIN_COUNT, getLines, getUniverses, rarityCounts, skinsOfUniverse } from '@/lib/skins';
import styles from './skins.module.css';

const MESSAGES = defineMessages({
  ru: {
    metaTitle: 'Все образы League of Legends',
    metaDescription: (n: number, lines: number) =>
      `Каталог всех ${n} образов League of Legends: ${lines} наборов, тематики и редкости, сплэш-арты, хромы, цены и даты выхода. Фильтры по чемпиону, набору и редкости.`,
    title: 'Образы',
    lead: (n: number, lines: number, universes: number) =>
      `${n} образов всех чемпионов: ${lines} наборов в ${universes} тематиках. У каждого — сплэш-арт, экран загрузки, хромы, цена и дата выхода.`,
    universes: 'Тематики',
  },
  en: {
    metaTitle: 'All League of Legends skins',
    metaDescription: (n: number, lines: number) =>
      `Catalog of all ${n} League of Legends skins: ${lines} skin lines, universes and rarities, splash art, chromas, prices and release dates. Filter by champion, line and rarity.`,
    title: 'Skins',
    lead: (n: number, lines: number, universes: number) =>
      `${n} skins for every champion: ${lines} skin lines across ${universes} universes. Each with splash art, loading screen, chromas, price and release date.`,
    universes: 'Universes',
  },
});

type Params = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const lang = await langOf(params);
  const t = MESSAGES[lang];
  return {
    title: t.metaTitle,
    description: t.metaDescription(SKIN_COUNT, getLines(lang).length),
    alternates: alternates(lang, '/skins'),
  };
}

export default async function SkinsPage({ params }: Params) {
  const lang = await langOf(params);
  const t = MESSAGES[lang];
  const lines = getLines(lang);
  const universes = getUniverses(lang);
  return (
    <div className="container">
      <PageHead title={t.title}>{t.lead(SKIN_COUNT, lines.length, universes.length)}</PageHead>
      <div className={styles.rarities}>
        {rarityCounts().map(({ rarity, count }) => (
          <Tag key={rarity} href={rarityHref(rarity)} color={RARITIES[lang][rarity].color} icon={<span className={styles.gem} />}>
            {RARITIES[lang][rarity].label} <span className="num">{count}</span>
          </Tag>
        ))}
      </div>
      <Suspense>
        <SkinCatalog
          champions={getChampions(lang).map((c) => ({ id: c.id, slug: c.slug, name: c.name }))}
          universes={universes.map((u) => ({ id: u.id, slug: u.slug, name: u.name }))}
          lines={lines.map((l) => ({ id: l.id, slug: l.slug, name: l.name, universe: l.universe }))}
        />
      </Suspense>
      <section className={styles.block}>
        <h2 className={styles.h2}>{t.universes}</h2>
        <ul className={styles.sets} role="list" style={{ marginTop: 18 }}>
          {universes.map((u) => (
            <li key={u.id}>
              <Link href={universeHref(u.slug)}>
                <span>{u.name}</span>
                <span className="num">{skinsOfUniverse(u.id, lang).length}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
