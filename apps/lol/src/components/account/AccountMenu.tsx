'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import Link from '@rift/engine/i18n/Link';
import { useMessages } from '@rift/engine/i18n/LocaleProvider';
import { Icon } from '@/components/Icon';
import { api } from '@/lib/account/client';
import { ACCOUNT_TEXT } from '@/lib/account/messages';
import { useAccount } from './AccountProvider';
import styles from './Account.module.css';

/** Слот шапки: «Войти» для гостя, меню с избранным, настройками и выходом — для вошедшего. */
export function AccountMenu() {
  const t = useMessages(ACCOUNT_TEXT);
  const { status, user, refresh, openAuth } = useAccount();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // пока сессия неизвестна, держим место под кнопку, чтобы шапка не прыгала
  if (status === 'loading') return <span className={styles.menuPlaceholder} aria-hidden="true" />;
  if (status === 'disabled') return null;

  if (status === 'guest' || !user) {
    return (
      <button type="button" className={styles.menuButton} aria-label={t.signIn} onClick={() => openAuth('sign-in')}>
        <Icon name="user" size={18} />
        <span className={styles.menuLabel}>{t.signIn}</span>
      </button>
    );
  }

  return (
    <div ref={ref} className={styles.menu}>
      <button type="button" className={styles.menuButton} aria-expanded={open} aria-label={t.accountMenu} onClick={() => setOpen((o) => !o)}>
        <span className={styles.avatar} aria-hidden="true">
          {user.email.slice(0, 1).toUpperCase()}
        </span>
        <Icon name="chevron-down" size={14} />
      </button>
      {open && (
        <div className={styles.menuList}>
          <p className={styles.menuEmail}>{user.email}</p>
          <Link href="/favorites" className={styles.menuLink} onClick={() => setOpen(false)}>
            <Icon name="favorite" size={16} /> {t.favorites}
          </Link>
          <Link href="/account/settings" className={styles.menuLink} onClick={() => setOpen(false)}>
            <Icon name="sliders" size={16} /> {t.settings}
          </Link>
          <button
            type="button"
            className={styles.menuLink}
            onClick={async () => {
              setOpen(false);
              await api.signOut();
              await refresh();
            }}
          >
            <Icon name="close" size={16} /> {t.signOut}
          </button>
        </div>
      )}
    </div>
  );
}
