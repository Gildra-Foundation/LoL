import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleFavorites, type FavoritesDeps, type FavoritesStore } from '@/lib/account/favorites';
import { capturedEmails, clearCapturedEmails, emailMode, EmailUnavailableError, sendEmail } from '@/lib/account/mail';
import { mailLink, mailLocale, renderMail } from '@/lib/account/mail-templates';
import { AUTH_RATE_RULES } from '@/lib/account/auth';
import { createLimiter } from '@/lib/account/rate-limit';
import { FAVORITES_MAX, isFavoriteRef, type Favorite } from '@/lib/account/shared';

afterEach(() => {
  vi.unstubAllEnvs();
  clearCapturedEmails();
});

describe('account emails', () => {
  it('picks the language from the page that asked for the email', () => {
    expect(mailLocale('https://riftden.com/api/auth/verify-email?token=x&callbackURL=%2Fen%2Faccount%2Fverify')).toBe('en');
    expect(mailLocale('https://riftden.com/api/auth/verify-email?token=x&callbackURL=%2Faccount%2Fverify')).toBe('ru');
    expect(mailLocale('https://riftden.com/api/auth/reset-password/abc?callbackURL=%2Fen%2Faccount%2Freset')).toBe('en');
    expect(mailLocale('not a url')).toBe('ru');
  });

  it('links to the site page, not to the API, and escapes the link in HTML', () => {
    expect(mailLink('verify', 'https://riftden.com', 'ru', 'a.b-c')).toBe('https://riftden.com/account/verify?token=a.b-c');
    expect(mailLink('reset', 'https://riftden.com', 'en', 't&x')).toBe('https://riftden.com/en/account/reset?token=t%26x');
    const mail = renderMail('reset', 'en', 'https://riftden.com/en/account/reset?token=a&b=<c>');
    expect(mail.subject).toBe('RiftDen: reset your password');
    expect(mail.html).toContain('href="https://riftden.com/en/account/reset?token=a&amp;b=&lt;c&gt;"');
    expect(mail.html).not.toContain('<c>');
    expect(mail.text).toContain('https://riftden.com/en/account/reset?token=a&b=<c>');
  });

  it('writes both languages for both kinds', () => {
    expect(renderMail('verify', 'ru', 'https://x/y').subject).toBe('RiftDen: подтвердите почту');
    expect(renderMail('verify', 'en', 'https://x/y').html).toContain('<html lang="en">');
    expect(renderMail('reset', 'ru', 'https://x/y').text).toContain('Задать новый пароль: https://x/y');
  });

  it('captures messages in capture mode', async () => {
    vi.stubEnv('EMAIL_TRANSPORT', 'capture');
    vi.stubEnv('BETTER_AUTH_URL', 'http://127.0.0.1:3015');
    expect(emailMode()).toBe('capture');
    await sendEmail({ to: 'a@example.com', subject: 's', text: 't', html: '<p>h</p>' });
    expect(capturedEmails()).toMatchObject([{ to: 'a@example.com', subject: 's', text: 't', html: '<p>h</p>' }]);
  });

  it('never captures on the public site and refuses to send without SMTP', async () => {
    vi.stubEnv('EMAIL_TRANSPORT', 'capture');
    vi.stubEnv('BETTER_AUTH_URL', 'https://riftden.com');
    expect(emailMode()).toBe('disabled');
    vi.stubEnv('EMAIL_TRANSPORT', 'smtp');
    vi.stubEnv('SMTP_HOST', '');
    expect(emailMode()).toBe('disabled');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await expect(sendEmail({ to: 'secret@example.com', subject: 's', text: 'https://link', html: '' })).rejects.toBeInstanceOf(EmailUnavailableError);
    // в журнал не попадают ни адрес, ни ссылка
    expect(warn.mock.calls.flat().join(' ')).not.toMatch(/secret@example\.com|https:\/\/link/);
    vi.stubEnv('SMTP_HOST', 'host.docker.internal');
    vi.stubEnv('EMAIL_FROM_ADDRESS', 'noreply@riftden.com');
    expect(emailMode()).toBe('smtp');
  });
});

describe('auth rate rules', () => {
  it('lets every page check the session without hitting the shared 100 per minute', () => {
    expect(AUTH_RATE_RULES['/get-session']).toEqual({ window: 60, max: 600 });
  });

  it('keeps sign-in, sign-up and password reset strict', () => {
    const perMinute = (rule: { window: number; max: number }) => (rule.max * 60) / rule.window;
    for (const path of ['/sign-in/email', '/sign-up/email', '/request-password-reset', '/reset-password', '/send-verification-email', '/change-password', '/delete-user'] as const) {
      expect(perMinute(AUTH_RATE_RULES[path])).toBeLessThanOrEqual(5);
    }
  });
});

describe('rate limiter', () => {
  it('allows max requests per window per key', () => {
    const limit = createLimiter(2, 1000);
    expect([limit.take('a', 0), limit.take('a', 10), limit.take('a', 20)]).toEqual([true, true, false]);
    expect(limit.take('b', 20)).toBe(true);
    expect(limit.take('a', 1005)).toBe(true);
  });

  it('forgets the oldest keys instead of growing without bound', () => {
    const limit = createLimiter(1, 60_000, 2);
    limit.take('a', 0);
    limit.take('b', 0);
    limit.take('c', 0);
    expect(limit.take('a', 1)).toBe(true);
    expect(limit.take('c', 1)).toBe(false);
  });
});

function memoryStore(max = FAVORITES_MAX): FavoritesStore & { rows: Favorite[] } {
  const rows: Favorite[] = [];
  return {
    rows,
    async list() {
      return rows;
    },
    async add(_user, kind, ref) {
      if (rows.some((r) => r.kind === kind && r.ref === ref)) return 'exists';
      if (rows.length >= max) return 'full';
      rows.push({ kind, ref, createdAt: new Date(0).toISOString() });
      return 'added';
    },
    async remove(_user, kind, ref) {
      rows.splice(0, rows.length, ...rows.filter((r) => !(r.kind === kind && r.ref === ref)));
    },
  };
}

describe('favorites API', () => {
  const origin = 'https://riftden.com';
  let deps: FavoritesDeps & { store: ReturnType<typeof memoryStore> };
  let signedIn: boolean;

  beforeEach(() => {
    signedIn = true;
    deps = {
      origin,
      user: async () => (signedIn ? { id: 'u1' } : null),
      store: memoryStore(2),
      limits: { ip: createLimiter(100, 60_000), read: createLimiter(100, 60_000), write: createLimiter(3, 60_000) },
    };
  });

  const request = (method: string, body?: unknown, headers: Record<string, string> = {}) =>
    new Request(`${origin}/api/favorites`, {
      method,
      headers: { origin, 'content-type': 'application/json', ...headers },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });

  it('requires a session', async () => {
    signedIn = false;
    expect((await handleFavorites(request('GET'), deps)).status).toBe(401);
    expect((await handleFavorites(request('POST', { kind: 'skin', ref: '103086' }), deps)).status).toBe(401);
  });

  it('rejects writes from other origins and cross-site fetches', async () => {
    expect((await handleFavorites(request('POST', { kind: 'skin', ref: '1' }, { origin: 'https://evil.example' }), deps)).status).toBe(403);
    expect((await handleFavorites(request('POST', { kind: 'skin', ref: '1' }, { 'sec-fetch-site': 'cross-site' }), deps)).status).toBe(403);
    const noOrigin = new Request(`${origin}/api/favorites`, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: '{"kind":"skin","ref":"1"}' });
    expect((await handleFavorites(noOrigin, deps)).status).toBe(403);
    expect(deps.store.rows).toEqual([]);
  });

  it('validates the body strictly', async () => {
    for (const body of [{ kind: 'item', ref: '1' }, { kind: 'skin', ref: '../x' }, { kind: 'skin', ref: '1', extra: 1 }, '[1]', 'not json', { kind: 'skin', ref: 'a'.repeat(81) }]) {
      expect((await handleFavorites(request('POST', body), deps)).status).toBe(400);
    }
    expect((await handleFavorites(request('POST', { kind: 'skin', ref: '1' }, { 'content-type': 'text/plain' }), deps)).status).toBe(400);
    expect((await handleFavorites(request('POST', `{"kind":"skin","ref":"${'x'.repeat(1100)}"}`), deps)).status).toBe(400);
  });

  it('adds, lists, deduplicates, caps and removes', async () => {
    const add = await handleFavorites(request('POST', { kind: 'skin', ref: '103086' }), deps);
    expect(add.status).toBe(201);
    expect(add.headers.get('cache-control')).toBe('no-store');
    expect((await handleFavorites(request('POST', { kind: 'skin', ref: '103086' }), deps)).status).toBe(200);
    expect((await handleFavorites(request('POST', { kind: 'champion', ref: 'ahri' }), deps)).status).toBe(201);
    deps.limits.write = createLimiter(100, 60_000);
    expect((await handleFavorites(request('POST', { kind: 'universe', ref: 'star-guardian' }), deps)).status).toBe(409);
    const list = await handleFavorites(request('GET'), deps);
    expect(((await list.json()) as { favorites: Favorite[] }).favorites.map((f) => `${f.kind}:${f.ref}`)).toEqual(['skin:103086', 'champion:ahri']);
    expect((await handleFavorites(request('DELETE', { kind: 'skin', ref: '103086' }), deps)).status).toBe(200);
    expect(deps.store.rows.map((r) => r.ref)).toEqual(['ahri']);
  });

  it('limits requests per account and per address', async () => {
    const statuses = [];
    for (let i = 0; i < 4; i++) statuses.push((await handleFavorites(request('POST', { kind: 'skin', ref: String(i) }), deps)).status);
    expect(statuses).toEqual([201, 201, 409, 429]);
    deps.limits.ip = createLimiter(1, 60_000);
    expect((await handleFavorites(request('GET', undefined, { 'cf-connecting-ip': '203.0.113.5' }), deps)).status).toBe(200);
    expect((await handleFavorites(request('GET', undefined, { 'cf-connecting-ip': '203.0.113.5' }), deps)).status).toBe(429);
  });

  it('answers 405 to other methods', async () => {
    expect((await handleFavorites(request('PUT', { kind: 'skin', ref: '1' }), deps)).status).toBe(405);
  });

  it('accepts skin ids and slugs as references', () => {
    expect(['103086', 'star-guardian', 'ahri', 'Kai_Sa'].every(isFavoriteRef)).toBe(true);
    expect(['', '-x', 'a/b', 'a b', 'é'].some(isFavoriteRef)).toBe(false);
  });
});
