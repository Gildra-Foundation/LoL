import type { Metadata } from 'next';
import { AccountHome } from '@/components/account/AccountPages';
import { defineMessages, langOf } from '@/lib/i18n';
import { AccountShell, privateMetadata } from './shell';

const TEXT = defineMessages({
  ru: { title: 'Аккаунт', lead: 'Вход и регистрация по почте. Аккаунт нужен для избранного.' },
  en: { title: 'Account', lead: 'Sign in or sign up with your email. An account keeps your favorites.' },
});

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return privateMetadata(TEXT[await langOf(params)].title);
}

export default async function AccountPage({ params }: { params: Promise<{ lang: string }> }) {
  const lang = await langOf(params);
  return (
    <AccountShell title={TEXT[lang].title} lead={TEXT[lang].lead}>
      <AccountHome />
    </AccountShell>
  );
}
