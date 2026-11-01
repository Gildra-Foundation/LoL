// Запросы браузера к /api/auth и /api/favorites. Ответы Better Auth: JSON с полем code при ошибке.
import type { Favorite, FavoriteKind } from './shared';

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  /** код ошибки Better Auth (INVALID_EMAIL_OR_PASSWORD, EMAIL_NOT_VERIFIED…) или RATE_LIMITED / NETWORK */
  code: string | null;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  createdAt: string;
}

async function call<T>(url: string, init: { method?: string; body?: unknown; captcha?: string | null } = {}): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (init.body !== undefined) headers['content-type'] = 'application/json';
  if (init.captcha) headers['x-captcha-response'] = init.captcha;
  try {
    const response = await fetch(url, {
      method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      credentials: 'same-origin',
      cache: 'no-store',
    });
    const data = (await response.json().catch(() => null)) as (T & { code?: string }) | null;
    const code = response.ok ? null : response.status === 429 ? 'RATE_LIMITED' : (data?.code ?? (response.status === 503 ? 'ACCOUNTS_UNAVAILABLE' : 'UNKNOWN'));
    return { ok: response.ok, status: response.status, data, code };
  } catch {
    return { ok: false, status: 0, data: null, code: 'NETWORK' };
  }
}

const auth = <T>(path: string, body?: unknown, captcha?: string | null) => call<T>(`/api/auth${path}`, { body, captcha });

export const api = {
  config: () => call<{ enabled: boolean; turnstileSiteKey: string | null }>('/api/account-config'),
  session: () => call<{ user: SessionUser } | null>('/api/auth/get-session'),
  signUp: (email: string, password: string, callbackURL: string, captcha?: string | null) =>
    auth('/sign-up/email', { email, password, name: email.split('@')[0], callbackURL }, captcha),
  signIn: (email: string, password: string, callbackURL: string) => auth<{ user: SessionUser }>('/sign-in/email', { email, password, callbackURL, rememberMe: true }),
  signOut: () => auth('/sign-out', {}),
  resendVerification: (email: string, callbackURL: string, captcha?: string | null) => auth('/send-verification-email', { email, callbackURL }, captcha),
  verifyEmail: (token: string) => call<{ status: boolean }>(`/api/auth/verify-email?token=${encodeURIComponent(token)}`),
  requestReset: (email: string, redirectTo: string, captcha?: string | null) => auth('/request-password-reset', { email, redirectTo }, captcha),
  resetPassword: (token: string, newPassword: string) => auth('/reset-password', { token, newPassword }),
  changePassword: (currentPassword: string, newPassword: string) => auth('/change-password', { currentPassword, newPassword, revokeOtherSessions: true }),
  deleteUser: (password: string) => auth('/delete-user', { password }),
  favorites: () => call<{ favorites: Favorite[] }>('/api/favorites'),
  addFavorite: (kind: FavoriteKind, ref: string) => call('/api/favorites', { method: 'POST', body: { kind, ref } }),
  removeFavorite: (kind: FavoriteKind, ref: string) => call('/api/favorites', { method: 'DELETE', body: { kind, ref } }),
};

export const favoriteKey = (kind: FavoriteKind, ref: string) => `${kind}:${ref}`;
