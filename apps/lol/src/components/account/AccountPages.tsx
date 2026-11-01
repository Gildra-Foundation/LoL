'use client';

// Клиентские части страниц /account: статическая оболочка рендерится при сборке, всё про посетителя — в браузере.
import { useEffect, useId, useState } from 'react';
import Link from '@rift/engine/i18n/Link';
import { useLocale, useMessages } from '@rift/engine/i18n/LocaleProvider';
import { localePath } from '@rift/engine/i18n/locale';
import { Button, buttonClass } from '@rift/engine/ui/Button';
import { api } from '@/lib/account/client';
import { ACCOUNT_TEXT, errorText } from '@/lib/account/messages';
import { PASSWORD_MAX, PASSWORD_MIN } from '@/lib/account/shared';
import { defineMessages } from '@/lib/i18n';
import { useAccount } from './AccountProvider';
import { AuthForm, useTurnstileKey } from './AuthForm';
import { Turnstile } from './Turnstile';
import styles from './Account.module.css';

const TEXT = defineMessages({
  ru: {
    verifyAction: 'Подтвердить почту',
    verifyLead: 'Нажмите кнопку, чтобы подтвердить адрес почты и войти.',
    verified: 'Почта подтверждена, вы вошли.',
    noToken: 'В адресе нет ссылки из письма. Откройте ссылку из письма ещё раз или запросите новое письмо.',
    resendLead: 'Укажите почту — пришлём новое письмо.',
    resetLead: 'Придумайте новый пароль. После смены выйдем из аккаунта на всех устройствах.',
    resetAction: 'Сменить пароль',
    resetDone: 'Пароль изменён. Войдите с новым паролем.',
    changeTitle: 'Смена пароля',
    changeDone: 'Пароль изменён. На других устройствах выполнен выход.',
    deleteTitle: 'Удаление аккаунта',
    deleteLead: 'Аккаунт, избранное и сессии удаляются сразу и без возможности восстановления.',
    deleteConfirm: 'Я понимаю, что это нельзя отменить',
    deleteAction: 'Удалить аккаунт',
    deleted: 'Аккаунт удалён.',
    since: 'Аккаунт создан',
    toFavorites: 'Открыть избранное',
    toSettings: 'Настройки аккаунта',
    toHome: 'На главную',
    needSignIn: 'Войдите, чтобы открыть эту страницу.',
  },
  en: {
    verifyAction: 'Confirm email',
    verifyLead: 'Press the button to confirm your email address and sign in.',
    verified: 'Your email is confirmed and you are signed in.',
    noToken: 'The address has no link from the email. Open the link from the email again or request a new one.',
    resendLead: 'Enter your email and we will send a new link.',
    resetLead: 'Choose a new password. After the change you will be signed out on every device.',
    resetAction: 'Change password',
    resetDone: 'The password was changed. Sign in with the new password.',
    changeTitle: 'Change password',
    changeDone: 'The password was changed. Other devices were signed out.',
    deleteTitle: 'Delete account',
    deleteLead: 'The account, favorites and sessions are deleted immediately and cannot be restored.',
    deleteConfirm: 'I understand this cannot be undone',
    deleteAction: 'Delete account',
    deleted: 'The account was deleted.',
    since: 'Account created',
    toFavorites: 'Open favorites',
    toSettings: 'Account settings',
    toHome: 'Home page',
    needSignIn: 'Sign in to open this page.',
  },
});

/** Токен из ссылки письма: ?token=… */
function useToken(): string | null | undefined {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  useEffect(() => setToken(new URLSearchParams(window.location.search).get('token')), []);
  return token;
}

function Loading() {
  const t = useMessages(ACCOUNT_TEXT);
  return (
    <p className={styles.muted} role="status">
      {t.loading}
    </p>
  );
}

/** /account: вход и регистрация для гостя, сводка — для вошедшего. */
export function AccountHome() {
  const a = useMessages(ACCOUNT_TEXT);
  const t = useMessages(TEXT);
  const { status, user } = useAccount();
  const [mode, setMode] = useState<'sign-in' | 'sign-up' | null>(null);
  useEffect(() => setMode(new URLSearchParams(window.location.search).get('mode') === 'sign-up' ? 'sign-up' : 'sign-in'), []);

  if (status === 'loading' || !mode) return <Loading />;
  if (status === 'disabled') return <p className={styles.error}>{a.errors.ACCOUNTS_UNAVAILABLE}</p>;
  if (!user) return <AuthForm initialMode={mode} />;
  return (
    <div className={styles.form}>
      <p>{a.signedInAs(user.email)}</p>
      <div className={styles.actionsRow}>
        <Link href="/favorites" className={buttonClass('primary')}>
          {t.toFavorites}
        </Link>
        <Link href="/account/settings" className={buttonClass('secondary')}>
          {t.toSettings}
        </Link>
      </div>
    </div>
  );
}

/** /account/verify?token=…: подтверждение почты по нажатию (почтовые сканеры ссылку не «нажмут»). */
export function VerifyEmail() {
  const a = useMessages(ACCOUNT_TEXT);
  const t = useMessages(TEXT);
  const locale = useLocale();
  const { refresh } = useAccount();
  const token = useToken();
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'failed'>('idle');
  const [error, setError] = useState<string | null>(null);

  if (token === undefined) return <Loading />;

  if (state === 'done') {
    return (
      <div className={styles.form}>
        <p className={styles.notice} role="status">
          {t.verified}
        </p>
        <div className={styles.actionsRow}>
          <Link href="/favorites" className={buttonClass('primary')}>
            {t.toFavorites}
          </Link>
          <Link href="/" className={buttonClass('secondary')}>
            {t.toHome}
          </Link>
        </div>
      </div>
    );
  }

  if (!token || state === 'failed') {
    return (
      <div className={styles.form}>
        <p className={styles.error} role="alert">
          {error ?? t.noToken}
        </p>
        <ResendVerification redirect={localePath(locale, '/account/verify')} />
      </div>
    );
  }

  return (
    <div className={styles.form}>
      <p>{t.verifyLead}</p>
      <Button
        variant="primary"
        disabled={state === 'busy'}
        onClick={async () => {
          setState('busy');
          const result = await api.verifyEmail(token);
          if (result.ok) {
            await refresh();
            setState('done');
          } else {
            setError(errorText(a, result.code));
            setState('failed');
          }
        }}
      >
        {t.verifyAction}
      </Button>
    </div>
  );
}

function ResendVerification({ redirect }: { redirect: string }) {
  const a = useMessages(ACCOUNT_TEXT);
  const t = useMessages(TEXT);
  const id = useId();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const siteKey = useTurnstileKey(true);

  return (
    <form
      className={styles.form}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const result = await api.resendVerification(email.trim().toLowerCase(), redirect, captcha);
        setCaptchaReset((n) => n + 1);
        setBusy(false);
        setMessage(result.ok ? { ok: true, text: a.resent } : { ok: false, text: errorText(a, result.code) });
      }}
    >
      <p className={styles.muted}>{t.resendLead}</p>
      <label className={styles.field} htmlFor={`${id}-email`}>
        <span>{a.email}</span>
        <input id={`${id}-email`} type="email" autoComplete="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      {siteKey && <Turnstile siteKey={siteKey} onToken={setCaptcha} resetKey={captchaReset} label={a.captcha} />}
      {message && (
        <p className={message.ok ? styles.notice : styles.error} role={message.ok ? 'status' : 'alert'}>
          {message.text}
        </p>
      )}
      <Button type="submit" disabled={busy || Boolean(siteKey && !captcha)}>
        {a.resend}
      </Button>
    </form>
  );
}

function PasswordPair({ id, value, repeat, onValue, onRepeat, label }: { id: string; value: string; repeat: string; onValue: (v: string) => void; onRepeat: (v: string) => void; label: string }) {
  const a = useMessages(ACCOUNT_TEXT);
  return (
    <>
      <div className={styles.field}>
        <label htmlFor={`${id}-new`}>{label}</label>
        <input id={`${id}-new`} type="password" autoComplete="new-password" required minLength={PASSWORD_MIN} maxLength={PASSWORD_MAX} value={value} onChange={(e) => onValue(e.target.value)} aria-describedby={`${id}-hint`} />
        <small id={`${id}-hint`} className={styles.muted}>
          {a.passwordHint}
        </small>
      </div>
      <label className={styles.field} htmlFor={`${id}-repeat`}>
        <span>{a.repeatPassword}</span>
        <input id={`${id}-repeat`} type="password" autoComplete="new-password" required minLength={PASSWORD_MIN} maxLength={PASSWORD_MAX} value={repeat} onChange={(e) => onRepeat(e.target.value)} />
      </label>
    </>
  );
}

/** /account/reset: без токена — запрос письма, с токеном из письма — новый пароль. */
export function ResetPassword() {
  const a = useMessages(ACCOUNT_TEXT);
  const t = useMessages(TEXT);
  const token = useToken();
  const id = useId();
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (token === undefined) return <Loading />;
  if (!token) return <AuthForm initialMode="forgot" />;
  if (done) {
    return (
      <div className={styles.form}>
        <p className={styles.notice} role="status">
          {t.resetDone}
        </p>
        <AuthForm initialMode="sign-in" />
      </div>
    );
  }

  return (
    <form
      className={styles.form}
      onSubmit={async (e) => {
        e.preventDefault();
        if (password !== repeat) return setError(a.errors.PASSWORDS_DIFFER);
        setBusy(true);
        setError(null);
        const result = await api.resetPassword(token, password);
        setBusy(false);
        if (result.ok) setDone(true);
        else setError(errorText(a, result.code));
      }}
    >
      <p>{t.resetLead}</p>
      <PasswordPair id={id} value={password} repeat={repeat} onValue={setPassword} onRepeat={setRepeat} label={a.newPassword} />
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" disabled={busy}>
        {t.resetAction}
      </Button>
    </form>
  );
}

/** /account/settings: почта, смена пароля, выход, удаление аккаунта. */
export function AccountSettings() {
  const a = useMessages(ACCOUNT_TEXT);
  const t = useMessages(TEXT);
  const locale = useLocale();
  const { status, user, refresh } = useAccount();
  const id = useId();
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [change, setChange] = useState<{ ok: boolean; text: string } | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);
  const [busy, setBusy] = useState(false);

  if (deleted) {
    return (
      <p className={styles.notice} role="status">
        {t.deleted}
      </p>
    );
  }
  if (status === 'loading') return <Loading />;
  if (!user) {
    return (
      <div className={styles.form}>
        <p>{t.needSignIn}</p>
        <AuthForm initialMode="sign-in" />
      </div>
    );
  }

  return (
    <div className={styles.settings}>
      <section className={styles.panel} aria-labelledby={`${id}-who`}>
        <h2 id={`${id}-who`}>{a.account}</h2>
        <p>{a.signedInAs(user.email)}</p>
        <p className={styles.muted}>
          {t.since}: {new Date(user.createdAt).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US')}
        </p>
        <Button
          onClick={async () => {
            await api.signOut();
            await refresh();
            window.location.assign(localePath(locale, '/'));
          }}
        >
          {a.signOut}
        </Button>
      </section>

      <section className={styles.panel} aria-labelledby={`${id}-change`}>
        <h2 id={`${id}-change`}>{t.changeTitle}</h2>
        <form
          className={styles.form}
          onSubmit={async (e) => {
            e.preventDefault();
            if (password !== repeat) return setChange({ ok: false, text: a.errors.PASSWORDS_DIFFER });
            setBusy(true);
            const result = await api.changePassword(current, password);
            setBusy(false);
            if (result.ok) {
              setCurrent('');
              setPassword('');
              setRepeat('');
            }
            setChange(result.ok ? { ok: true, text: t.changeDone } : { ok: false, text: errorText(a, result.code) });
          }}
        >
          <label className={styles.field} htmlFor={`${id}-current`}>
            <span>{a.currentPassword}</span>
            <input id={`${id}-current`} type="password" autoComplete="current-password" required maxLength={PASSWORD_MAX} value={current} onChange={(e) => setCurrent(e.target.value)} />
          </label>
          <PasswordPair id={id} value={password} repeat={repeat} onValue={setPassword} onRepeat={setRepeat} label={a.newPassword} />
          {change && (
            <p className={change.ok ? styles.notice : styles.error} role={change.ok ? 'status' : 'alert'}>
              {change.text}
            </p>
          )}
          <Button type="submit" disabled={busy}>
            {t.changeTitle}
          </Button>
        </form>
      </section>

      <section className={`${styles.panel} ${styles.danger}`} aria-labelledby={`${id}-delete`}>
        <h2 id={`${id}-delete`}>{t.deleteTitle}</h2>
        <p className={styles.muted}>{t.deleteLead}</p>
        <form
          className={styles.form}
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const result = await api.deleteUser(deletePassword);
            setBusy(false);
            if (!result.ok) return setDeleteError(errorText(a, result.code));
            setDeleted(true);
            await refresh();
          }}
        >
          <label className={styles.field} htmlFor={`${id}-delete-password`}>
            <span>{a.password}</span>
            <input id={`${id}-delete-password`} type="password" autoComplete="current-password" required maxLength={PASSWORD_MAX} value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} />
          </label>
          <label className={styles.check}>
            <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
            <span>{t.deleteConfirm}</span>
          </label>
          {deleteError && (
            <p className={styles.error} role="alert">
              {deleteError}
            </p>
          )}
          <Button type="submit" className={styles.dangerButton} disabled={busy || !confirm}>
            {t.deleteAction}
          </Button>
        </form>
      </section>
    </div>
  );
}
