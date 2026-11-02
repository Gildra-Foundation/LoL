'use client';

import { useEffect, useRef, useState } from 'react';
import { useMessages } from '@rift/engine/i18n/LocaleProvider';
import { useAccount } from '@/components/account/AccountProvider';
import { Icon } from '@/components/Icon';
import { favoriteKey } from '@/lib/account/client';
import type { FavoriteKind } from '@/lib/account/shared';
import { defineMessages } from '@/lib/i18n';
import styles from './FavoriteButton.module.css';

const MESSAGES = defineMessages({
  ru: { add: 'В избранное', added: 'В избранном', remove: 'Убрать из избранного', failed: 'Не удалось сохранить, попробуйте ещё раз' },
  en: { add: 'Add to favorites', added: 'In favorites', remove: 'Remove from favorites', failed: 'Could not save, please try again' },
});

interface FavoriteButtonProps {
  kind: FavoriteKind;
  /**
   * что добавляем: id скина (103086) или слаг набора, тематики, чемпиона. Не `ref`: этот проп React
   * не передаёт клиентскому компоненту из серверной страницы.
   */
  id: string | number;
  /** только значок с подписью для экранного диктора — для карточек каталога */
  compact?: boolean;
  /** в ряду меток (класс, редкость) — высотой с метку */
  tag?: boolean;
  className?: string;
}

/**
 * «♡ В избранное». Гостю открывает окно входа и добавляет объект сразу после входа.
 * Если аккаунты на сервере не настроены, кнопки нет.
 */
export function FavoriteButton({ kind, id, compact = false, tag = false, className }: FavoriteButtonProps) {
  const t = useMessages(MESSAGES);
  const { status, favorites, toggleFavorite, openAuth } = useAccount();
  const ref = String(id);
  const active = favorites?.has(favoriteKey(kind, ref)) ?? false;
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const pending = useRef(false);

  const toggle = async () => {
    setBusy(true);
    setFailed(false);
    const result = await toggleFavorite(kind, ref);
    setBusy(false);
    if (result === null) setFailed(true);
  };

  // гость нажал «В избранное» и вошёл — добавляем то, что он хотел
  useEffect(() => {
    if (!pending.current || status !== 'user' || !favorites) return;
    pending.current = false;
    if (!favorites.has(favoriteKey(kind, ref))) void toggle();
    // toggle новый на каждом рендере — эффект ждёт только входа и загрузки избранного
  }, [status, favorites]);

  if (status === 'disabled') return null;

  const label = active ? t.added : t.add;
  return (
    <button
      type="button"
      className={[styles.button, compact ? styles.compact : '', tag ? styles.tag : '', className].filter(Boolean).join(' ')}
      aria-pressed={status === 'user' ? active : false}
      // у значка подпись постоянная, состояние передаёт aria-pressed
      aria-label={compact ? t.add : undefined}
      title={failed ? t.failed : active ? t.remove : t.add}
      data-active={active || undefined}
      disabled={status === 'loading' || busy}
      onClick={() => {
        if (status !== 'user') {
          pending.current = true;
          openAuth('sign-in');
          return;
        }
        void toggle();
      }}
    >
      <Icon name="favorite" size={compact ? 18 : tag ? 15 : 20} className={styles.icon} />
      {!compact && <span>{label}</span>}
    </button>
  );
}
