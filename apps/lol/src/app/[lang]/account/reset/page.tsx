import type { Metadata } from 'next';
import { ResetPassword } from '@/components/account/AccountPages';
import { defineMessages, langOf } from '@/lib/i18n';
import { AccountShell, privateMetadata } from '../shell';

const TEXT = defineMessages({ ru: { title: 'Сброс пароля' }, en: { title: 'Reset password' } });

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return privateMetadata(TEXT[await langOf(params)].title);
}

export default async function ResetPage({ params }: { params: Promise<{ lang: string }> }) {
  const lang = await langOf(params);
  return (
    <AccountShell title={TEXT[lang].title}>
      <ResetPassword />
    </AccountShell>
  );
}
