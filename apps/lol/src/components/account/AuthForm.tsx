'use client';

import { useEffect, useId, useState } from 'react';
import Link from '@rift/engine/i18n/Link';
import { useLocale, useMessages } from '@rift/engine/i18n/LocaleProvider';
import { localePath } from '@rift/engine/i18n/locale';
import { Button } from '@rift/engine/ui/Button';
import { api } from '@/lib/account/client';
import { ACCOUNT_TEXT, errorText } from '@/lib/account/messages';
import { PASSWORD_MAX, PASSWORD_MIN } from '@/lib/account/shared';
import { useAccount } from './AccountProvider';
import { Turnstile } from './Turnstile';
import styles from './Account.module.css';

export type AuthMode = 'sign-in' | 'sign-up' | 'forgot';

/** Ключ Turnstile: один запрос на страницу, null — проверки нет. */
let siteKeyPromise: Promise<string | null> | null = null;
const loadSiteKey = () => (siteKeyPromise ??= api.config().then((r) => r.data?.turnstileSiteKey ?? null));

export function useTurnstileKey(enabled: boolean) {
  const [siteKey, setSiteKey] = useState<string | null>(null);
  useEffect(() => {
    if (enabled) void loadSiteKey().then(setSiteKey);
  }, [enabled]);
  return siteKey;
}

/** Вход, регистрация и запрос сброса пароля — в окне входа и на странице /account. */
export function AuthForm({ initialMode = 'sign-in', onDone }: { initialMode?: AuthMode; onDone?: () => void }) {
  const t = useMessages(ACCOUNT_TEXT);
  const locale = useLocale();
  const { refresh } = useAccount();
  const id = useId();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sent, setSent] = useState<'verify' | 'reset' | null>(null);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const siteKey = useTurnstileKey(mode !== 'sign-in');

  const verifyPage = localePath(locale, '/account/verify');
  const resetPage = localePath(locale, '/account/reset');

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError(null);
    setNotice(null);
    setSent(null);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    const cleanEmail = email.trim().toLowerCase();
    try {
      if (mode === 'sign-in') {
        const result = await api.signIn(cleanEmail, password, verifyPage);
        if (result.ok) {
          await refresh();
          onDone?.();
          return;
        }
        if (result.code === 'EMAIL_NOT_VERIFIED') setNotice(t.notVerified);
        else setError(errorText(t, result.code));
      } else if (mode === 'sign-up') {
        const result = await api.signUp(cleanEmail, password, verifyPage, captcha);
        setCaptchaReset((n) => n + 1);
        if (result.ok) setSent('verify');
        else setError(errorText(t, result.code));
      } else {
        const result = await api.requestReset(cleanEmail, resetPage, captcha);
        setCaptchaReset((n) => n + 1);
        if (result.ok) setSent('reset');
        else setError(errorText(t, result.code));
      }
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    const result = await api.resendVerification(email.trim().toLowerCase(), verifyPage, captcha);
    setCaptchaReset((n) => n + 1);
    setBusy(false);
    if (result.ok) setNotice(t.resent);
    else setError(errorText(t, result.code));
  }

  if (sent) {
    return (
      <div className={styles.form}>
        <p className={styles.notice} role="status">
          {sent === 'verify' ? t.checkMail(email.trim()) : t.resetSent(email.trim())}
        </p>
        {sent === 'verify' && (
          <>
            {siteKey && <Turnstile siteKey={siteKey} onToken={setCaptcha} resetKey={captchaReset} label={t.captcha} />}
            <Button onClick={resend} disabled={busy || Boolean(siteKey && !captcha)}>
              {t.resend}
            </Button>
          </>
        )}
        {notice && <p className={styles.notice} role="status">{notice}</p>}
        {error && <p className={styles.error} role="alert">{error}</p>}
        <button type="button" className={styles.linkButton} onClick={() => switchMode('sign-in')}>
          {t.back}
        </button>
      </div>
    );
  }

  const needsCaptcha = mode !== 'sign-in' && Boolean(siteKey);

  return (
    <form className={styles.form} onSubmit={submit}>
      {mode === 'forgot' ? (
        <div>
          <h2 className={styles.formTitle}>{t.forgotTitle}</h2>
          <p className={styles.muted}>{t.forgotLead}</p>
        </div>
      ) : (
        <div className={styles.tabs} role="group" aria-label={t.account}>
          {(['sign-in', 'sign-up'] as const).map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} className={styles.tab} onClick={() => switchMode(m)}>
              {m === 'sign-in' ? t.signIn : t.signUp}
            </button>
          ))}
        </div>
      )}

      <label className={styles.field} htmlFor={`${id}-email`}>
        <span>{t.email}</span>
        <input id={`${id}-email`} type="email" name="email" autoComplete="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>

      {mode !== 'forgot' && (
        <div className={styles.field}>
          <label htmlFor={`${id}-password`}>{t.password}</label>
          <input
            id={`${id}-password`}
            type="password"
            name="password"
            autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
            required
            minLength={mode === 'sign-up' ? PASSWORD_MIN : undefined}
            maxLength={PASSWORD_MAX}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby={mode === 'sign-up' ? `${id}-hint` : undefined}
          />
          {mode === 'sign-up' && (
            <small id={`${id}-hint`} className={styles.muted}>
              {t.passwordHint}
            </small>
          )}
        </div>
      )}

      {needsCaptcha && <Turnstile siteKey={siteKey!} onToken={setCaptcha} resetKey={captchaReset} label={t.captcha} />}

      {notice && <p className={styles.notice} role="status">{notice}</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}

      <Button type="submit" variant="primary" disabled={busy || (needsCaptcha && !captcha)}>
        {mode === 'sign-in' ? t.signIn : mode === 'sign-up' ? t.signUpAction : t.sendLink}
      </Button>

      {mode === 'sign-in' && (
        <button type="button" className={styles.linkButton} onClick={() => switchMode('forgot')}>
          {t.forgot}
        </button>
      )}
      {mode === 'sign-up' && (
        <p className={styles.muted}>
          {t.privacyPrefix}{' '}
          <Link href="/privacy" onClick={onDone}>
            {t.privacyLink}
          </Link>
          .
        </p>
      )}
      {mode === 'forgot' && (
        <button type="button" className={styles.linkButton} onClick={() => switchMode('sign-in')}>
          {t.back}
        </button>
      )}
    </form>
  );
}
