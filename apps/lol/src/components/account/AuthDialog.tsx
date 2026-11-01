'use client';

import { useEffect, useRef } from 'react';
import { useMessages } from '@rift/engine/i18n/LocaleProvider';
import { Icon } from '@/components/Icon';
import { ACCOUNT_TEXT } from '@/lib/account/messages';
import { AuthForm } from './AuthForm';
import styles from './Account.module.css';

/** Окно входа и регистрации поверх страницы: Esc и клик мимо закрывают, после входа закрывается само. */
export function AuthDialog({ mode, onClose }: { mode: 'sign-in' | 'sign-up'; onClose: () => void }) {
  const t = useMessages(ACCOUNT_TEXT);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby="auth-dialog-title"
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div className={styles.dialogHead}>
        <h2 id="auth-dialog-title">{t.dialogTitle}</h2>
        <button type="button" className={styles.dialogClose} aria-label={t.close} onClick={onClose}>
          <Icon name="close" size={20} />
        </button>
      </div>
      <p className={styles.muted}>{t.dialogLead}</p>
      <AuthForm initialMode={mode} onDone={onClose} />
    </dialog>
  );
}
