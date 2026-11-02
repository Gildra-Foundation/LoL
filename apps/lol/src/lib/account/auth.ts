// Better Auth: вход по почте и паролю с обязательным подтверждением почты. Один экземпляр на процесс.
import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { captcha } from 'better-auth/plugins/captcha';
import { PASSWORD_MAX, PASSWORD_MIN } from './shared';
import { authOrigin, rateLimitEnabled, secureCookies, turnstile } from './config';
import { getPool } from './db';
import { sendEmail } from './mail';
import { mailLink, mailLocale, renderMail, type MailKind } from './mail-templates';

const send = async (kind: MailKind, to: string, url: string, token: string) => {
  const locale = mailLocale(url);
  await sendEmail({ to, ...renderMail(kind, locale, mailLink(kind, authOrigin(), locale, token)) });
};

/**
 * Лимиты попыток по адресу посетителя, хранятся в таблице rateLimit — переживают перезапуск контейнера.
 * Окно в секундах. Счётчик у каждого адреса свой; остальные адреса /api/auth — 100 запросов в минуту.
 * Проверку сессии делает каждая страница сайта: за общим IP (офис, мобильный оператор) 100 в минуту
 * кончаются быстро, и вошедший видит «Войти». Подбирать через неё нечего — лимит мягкий.
 */
export const AUTH_RATE_RULES = {
  '/get-session': { window: 60, max: 600 },
  '/sign-up/email': { window: 600, max: 5 },
  '/sign-in/email': { window: 60, max: 5 },
  '/request-password-reset': { window: 600, max: 3 },
  '/send-verification-email': { window: 600, max: 3 },
  '/reset-password': { window: 600, max: 5 },
  '/change-password': { window: 600, max: 5 },
  '/delete-user': { window: 600, max: 5 },
  '/verify-email': { window: 600, max: 10 },
} as const;

export function authOptions(): BetterAuthOptions {
  const captchaKeys = turnstile();
  return {
    appName: 'RiftDen',
    baseURL: authOrigin(),
    basePath: '/api/auth',
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: [authOrigin()],
    database: getPool(),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      autoSignIn: false,
      minPasswordLength: PASSWORD_MIN,
      maxPasswordLength: PASSWORD_MAX,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: 3600,
      sendResetPassword: ({ user, url, token }) => send('reset', user.email, url, token),
    },
    emailVerification: {
      sendOnSignUp: true,
      // вход с неподтверждённой почтой отклоняется и присылает письмо заново (в пределах лимита входа)
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      expiresIn: 24 * 3600,
      sendVerificationEmail: ({ user, url, token }) => send('verify', user.email, url, token),
    },
    user: { deleteUser: { enabled: true } },
    session: { expiresIn: 30 * 24 * 3600, updateAge: 24 * 3600 },
    rateLimit: { enabled: rateLimitEnabled(), storage: 'database', window: 60, max: 100, customRules: AUTH_RATE_RULES },
    advanced: {
      cookiePrefix: 'riftden',
      // Origin проверяется всегда — и в тестах, где Better Auth по умолчанию её пропускает
      disableOriginCheck: false,
      useSecureCookies: secureCookies(),
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax', secure: secureCookies(), path: '/' },
      // адрес посетителя для лимитов присылает Cloudflare; без него — адрес, добавленный nginx
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip', 'x-forwarded-for'] },
    },
    telemetry: { enabled: false },
    plugins: captchaKeys
      ? [captcha({ provider: 'cloudflare-turnstile', secretKey: captchaKeys.secretKey, endpoints: ['/sign-up/email', '/request-password-reset', '/send-verification-email'] })]
      : [],
  };
}

const createAuth = () => betterAuth(authOptions());
const store = globalThis as typeof globalThis & { __riftdenAuth?: ReturnType<typeof createAuth> };

export function getAuth() {
  store.__riftdenAuth ??= createAuth();
  return store.__riftdenAuth;
}

/** Пользователь по cookie запроса или null. */
export async function sessionUser(request: Request): Promise<{ id: string; email: string } | null> {
  const session = await getAuth().api.getSession({ headers: request.headers });
  return session ? { id: session.user.id, email: session.user.email } : null;
}
