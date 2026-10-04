import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHead } from '@rift/engine/ui/PageHead';
import { BuildEditor } from '@/components/builds/BuildEditor';
import type { BuildChampion } from '@/lib/build';
import { getChampions } from '@/lib/champions';
import { alternates, defineMessages, langOf, LOCALE_TAG } from '@/lib/i18n';
import { getItems, getRunes, getSpells } from '@/lib/shop';

const MESSAGES = defineMessages({
  ru: {
    title: 'Конструктор билдов',
    description: 'Конструктор билдов League of Legends: чемпион и линия, руны, заклинания призывателя и предметы с расчётом характеристик и стоимости.',
    lead: 'Соберите билд как в клиенте: чемпион и линия, руны, заклинания призывателя и предметы. Справа — итоговые характеристики и стоимость. Ссылка на странице всегда описывает текущий билд, а сохранённые билды остаются в этом браузере.',
  },
  en: {
    title: 'Build editor',
    description: 'League of Legends build editor: champion and lane, runes, summoner spells and items, with total stats and cost.',
    lead: 'Put a build together like in the client: champion and lane, runes, summoner spells and items. Total stats and cost are on the right. The page link always describes the current build, and saved builds stay in this browser.',
  },
});

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const lang = await langOf(params);
  const t = MESSAGES[lang];
  return { title: t.title, description: t.description, alternates: alternates(lang, '/builds') };
}

export default async function BuildsPage({ params }: { params: Promise<{ lang: string }> }) {
  const lang = await langOf(params);
  const t = MESSAGES[lang];
  const data: BuildChampion[] = getChampions(lang)
    .map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      title: c.title,
      positions: c.positions,
      damageType: c.tactical?.damageType ?? 'kPhysical',
      partype: c.partype,
      resource: c.resource,
      stats: c.stats,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, LOCALE_TAG[lang]));

  return (
    <div className="container">
      <PageHead title={t.title}>{t.lead}</PageHead>
      <Suspense fallback={<div style={{ minHeight: 720 }} />}>
        <BuildEditor champions={data} items={getItems(lang)} runes={getRunes(lang)} spells={getSpells(lang)} />
      </Suspense>
    </div>
  );
}
