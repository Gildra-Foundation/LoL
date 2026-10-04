'use client';

import Link from '@rift/engine/i18n/Link';
import { useMessages } from '@rift/engine/i18n/LocaleProvider';
import { defineMessages } from '@rift/engine/i18n/locale';
import { buttonClass } from '@rift/engine/ui/Button';
import { Keycap } from '@rift/engine/ui/Keycap';
import styles from './not-found.module.css';

// параметров у страницы 404 нет — язык берётся из макета [lang], внутри которого она показывается
const MESSAGES = defineMessages({
  ru: {
    title: 'Такой страницы нет',
    text: (key: React.ReactNode) => <>Адрес мог измениться или в нём опечатка. Найдите чемпиона через поиск — клавиша {key} — или начните с главной.</>,
    home: 'На главную',
    champions: 'Все чемпионы',
  },
  en: {
    title: 'No such page',
    text: (key: React.ReactNode) => <>The address may have changed or contain a typo. Find a champion with search (press {key}) or start from the home page.</>,
    home: 'Home page',
    champions: 'All champions',
  },
});

export default function NotFound() {
  const t = useMessages(MESSAGES);
  return (
    <div className={`container ${styles.wrap}`}>
      <p className={styles.code}>404</p>
      <h1>{t.title}</h1>
      <p className={styles.text}>{t.text(<Keycap size="sm">/</Keycap>)}</p>
      <div className={styles.actions}>
        <Link href="/" className={buttonClass('primary')}>
          {t.home}
        </Link>
        <Link href="/champions" className={buttonClass('secondary')}>
          {t.champions}
        </Link>
      </div>
    </div>
  );
}
