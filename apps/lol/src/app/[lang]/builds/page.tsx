import type { Metadata } from 'next';
import { PageHead } from '@rift/engine/ui/PageHead';
import { BuildLoader } from '@/components/builds/BuildLoader';
import { alternates, defineMessages, langOf } from '@/lib/i18n';

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

  return (
    <div className="container">
      <PageHead title={t.title}>{t.lead}</PageHead>
      <BuildLoader />
    </div>
  );
}
