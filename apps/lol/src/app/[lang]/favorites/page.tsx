import type { Metadata } from 'next';
import { FavoritesView } from '@/components/favorites/FavoritesView';
import { defineMessages, langOf } from '@/lib/i18n';
import { AccountShell, privateMetadata } from '../account/shell';

const TEXT = defineMessages({
  ru: { title: 'Избранное', lead: 'Образы, наборы, тематики и чемпионы, которые вы отметили ♡.' },
  en: { title: 'Favorites', lead: 'Skins, skin lines, universes and champions you marked with ♡.' },
});

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return privateMetadata(TEXT[await langOf(params)].title);
}

export default async function FavoritesPage({ params }: { params: Promise<{ lang: string }> }) {
  const lang = await langOf(params);
  return (
    <AccountShell title={TEXT[lang].title} lead={TEXT[lang].lead}>
      <FavoritesView />
    </AccountShell>
  );
}
