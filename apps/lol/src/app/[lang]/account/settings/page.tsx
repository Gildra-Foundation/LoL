import type { Metadata } from 'next';
import { AccountSettings } from '@/components/account/AccountPages';
import { defineMessages, langOf } from '@/lib/i18n';
import { AccountShell, privateMetadata } from '../shell';

const TEXT = defineMessages({ ru: { title: 'Настройки аккаунта' }, en: { title: 'Account settings' } });

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return privateMetadata(TEXT[await langOf(params)].title);
}

export default async function SettingsPage({ params }: { params: Promise<{ lang: string }> }) {
  const lang = await langOf(params);
  return (
    <AccountShell title={TEXT[lang].title}>
      <AccountSettings />
    </AccountShell>
  );
}
