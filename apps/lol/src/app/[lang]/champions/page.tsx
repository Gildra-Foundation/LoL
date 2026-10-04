import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Catalog, type CatalogChampion } from '@/components/catalog/Catalog';
import { PATCH } from '@/lib/assets';
import { CHAMPION_COUNT, championsLite, getChampion, statsOf } from '@/lib/champions';
import { alternates, defineMessages, langOf } from '@/lib/i18n';
import { PageHead } from '@rift/engine/ui/PageHead';

const MESSAGES = defineMessages({
  ru: {
    metaTitle: 'Все чемпионы',
    metaDescription: (n: number, patch: string) =>
      `Каталог всех ${n} чемпионов League of Legends: фильтры по классу, позиции, типу атаки, урону и сложности. Патч ${patch}.`,
    title: 'Чемпионы',
    lead: (n: number, patch: string) =>
      `Все ${n} чемпионов патча ${patch}. Полоска под именем — здоровье на 18 уровне: чем она длиннее и чем больше на ней делений, тем живучее чемпион без предметов.`,
  },
  en: {
    metaTitle: 'All champions',
    metaDescription: (n: number, patch: string) =>
      `Catalog of all ${n} League of Legends champions: filter by class, position, attack type, damage and difficulty. Patch ${patch}.`,
    title: 'Champions',
    lead: (n: number, patch: string) =>
      `All ${n} champions as of patch ${patch}. The bar under the name is health at level 18: the longer it is and the more segments it has, the tougher the champion is without items.`,
  },
});

type Params = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const lang = await langOf(params);
  const t = MESSAGES[lang];
  return {
    title: t.metaTitle,
    description: t.metaDescription(CHAMPION_COUNT, PATCH),
    alternates: alternates(lang, '/champions'),
  };
}

export default async function ChampionsPage({ params }: Params) {
  const lang = await langOf(params);
  const t = MESSAGES[lang];
  const lite = championsLite(lang);
  const data: CatalogChampion[] = lite.map((c) => {
    const full = getChampion(c.id, lang)!;
    const at18 = statsOf(full, 18);
    return {
      id: c.id,
      slug: c.slug,
      name: c.name,
      title: c.title,
      tags: c.tags,
      positions: c.positions,
      attackType: c.attackType,
      damageType: c.damageType,
      difficulty: c.difficulty,
      release: c.release,
      hp18: at18.hp,
      ad18: at18.attackdamage,
      armor18: at18.armor,
      range: c.stats.attackrange,
      ms: c.stats.movespeed,
    };
  });
  const maxHp = Math.max(...data.map((c) => c.hp18));

  return (
    <div className="container">
      <PageHead title={t.title}>{t.lead(CHAMPION_COUNT, PATCH)}</PageHead>
      <Suspense>
        <Catalog champions={data} maxHp={maxHp} />
      </Suspense>
    </div>
  );
}
