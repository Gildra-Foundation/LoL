// Аккаунты на настоящем Postgres: TEST_DATABASE_URL=postgres://…/<имя>_test (база очищается!). Без переменной тесты пропускаются.
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const url = process.env.TEST_DATABASE_URL;
const safe = url && /^postgres(ql)?:\/\/[^/]*@(127\.0\.0\.1|localhost|db|postgres)(:\d+)?\/[a-z0-9_]+_test$/.test(url);
const origin = 'http://127.0.0.1:3999';

describe.skipIf(!safe)('accounts with Postgres', () => {
  let pool: Pool;
  let auth: typeof import('@/lib/account/auth');
  let mail: typeof import('@/lib/account/mail');
  let favorites: typeof import('@/lib/account/favorites');
  let migrations: typeof import('@/lib/account/migrations');

  beforeAll(async () => {
    pool = new Pool({ connectionString: url });
    await pool.query('drop schema public cascade; create schema public');
    vi.stubEnv('DATABASE_URL', url!);
    vi.stubEnv('BETTER_AUTH_SECRET', 'test-secret-test-secret-test-secret-1234');
    vi.stubEnv('BETTER_AUTH_URL', origin);
    vi.stubEnv('EMAIL_TRANSPORT', 'capture');
    vi.stubEnv('AUTH_RATE_LIMIT', 'on');
    vi.stubEnv('TURNSTILE_SECRET_KEY', '');
    migrations = await import('@/lib/account/migrations');
    auth = await import('@/lib/account/auth');
    mail = await import('@/lib/account/mail');
    favorites = await import('@/lib/account/favorites');
  });

  afterAll(async () => {
    await pool?.end();
    vi.unstubAllEnvs();
  });

  let ip = 0;
  /** Запрос к Better Auth с отдельным адресом посетителя, чтобы тесты не делили лимиты. */
  const call = (path: string, body?: unknown, headers: Record<string, string> = {}) =>
    auth.getAuth().handler(
      new Request(`${origin}/api/auth${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { origin, 'content-type': 'application/json', 'cf-connecting-ip': `198.51.100.${++ip % 250}`, ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
  const cookieOf = (response: Response) =>
    response.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .filter((c) => !c.endsWith('='))
      .join('; ');
  const lastToken = (to: string) => {
    const message = mail.capturedEmails().filter((m) => m.to === to).at(-1);
    return message?.text.match(/token=([^\s&]+)/)?.[1];
  };

  it('applies migrations once and keeps them idempotent', async () => {
    expect(await migrations.migrate(pool)).toEqual(['0001_better_auth', '0002_favorite']);
    expect(await migrations.migrate(pool)).toEqual([]);
    const tables = (await pool.query("select tablename from pg_tables where schemaname = 'public' order by 1")).rows.map((r) => r.tablename);
    expect(tables).toEqual(['account', 'favorite', 'rateLimit', 'riftden_migration', 'session', 'user', 'verification']);
  });

  it('signs up, requires email confirmation, verifies, signs in and keeps favorites', async () => {
    const email = 'player@example.com';
    const signUp = await call('/sign-up/email', { email, password: 'correct horse battery', name: 'player', callbackURL: '/en/account/verify' });
    expect(signUp.status).toBe(200);
    expect(cookieOf(signUp)).toBe('');
    const letter = mail.capturedEmails().at(-1)!;
    expect(letter).toMatchObject({ to: email, subject: 'RiftDen: confirm your email' });
    expect(letter.text).toContain(`${origin}/en/account/verify?token=`);

    const unverified = await call('/sign-in/email', { email, password: 'correct horse battery' });
    expect(unverified.status).toBe(403);
    expect(((await unverified.json()) as { code: string }).code).toBe('EMAIL_NOT_VERIFIED');

    const verify = await call(`/verify-email?token=${lastToken(email)}`);
    expect(verify.status).toBe(200);
    const cookie = cookieOf(verify);
    expect(cookie).toMatch(/^riftden\.session_token=/);
    const setCookie = verify.headers.getSetCookie().find((c) => c.startsWith('riftden.session_token='))!;
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);

    const session = await call('/get-session', undefined, { cookie });
    expect(((await session.json()) as { user: { email: string; emailVerified: boolean } }).user).toMatchObject({ email, emailVerified: true });

    const user = await auth.sessionUser(new Request(`${origin}/api/favorites`, { headers: { cookie } }));
    expect(user?.email).toBe(email);
    const store = favorites.pgFavorites(pool);
    expect(await store.add(user!.id, 'skin', '103086')).toBe('added');
    expect(await store.add(user!.id, 'skin', '103086')).toBe('exists');
    expect(await store.add(user!.id, 'skinline', 'star-guardian')).toBe('added');
    expect((await store.list(user!.id)).map((f) => f.ref)).toEqual(['star-guardian', '103086']);
    await store.remove(user!.id, 'skin', '103086');
    expect((await store.list(user!.id)).map((f) => f.ref)).toEqual(['star-guardian']);

    // удаление аккаунта: по паролю, вместе с избранным и сессиями
    const wrong = await call('/delete-user', { password: 'not the password' }, { cookie });
    expect(wrong.status).toBe(400);
    expect((await call('/delete-user', { password: 'correct horse battery' }, { cookie })).status).toBe(200);
    expect((await pool.query('select count(*)::int as n from favorite')).rows[0].n).toBe(0);
    expect((await pool.query('select count(*)::int as n from "session"')).rows[0].n).toBe(0);
  });

  it('resets a forgotten password and signs out every session', async () => {
    const email = 'reset@example.com';
    await call('/sign-up/email', { email, password: 'first password 1', name: 'reset', callbackURL: '/account/verify' });
    const verified = await call(`/verify-email?token=${lastToken(email)}`);
    const oldCookie = cookieOf(verified);

    expect((await call('/request-password-reset', { email, redirectTo: '/account/reset' })).status).toBe(200);
    const letter = mail.capturedEmails().at(-1)!;
    expect(letter.subject).toBe('RiftDen: сброс пароля');
    expect(letter.text).toContain(`${origin}/account/reset?token=`);
    // неизвестная почта отвечает так же, письма нет
    const before = mail.capturedEmails().length;
    expect((await call('/request-password-reset', { email: 'nobody@example.com', redirectTo: '/account/reset' })).status).toBe(200);
    expect(mail.capturedEmails().length).toBe(before);

    expect((await call('/reset-password', { token: lastToken(email), newPassword: 'short' })).status).toBe(400);
    expect((await call('/reset-password', { token: lastToken(email), newPassword: 'second password 2' })).status).toBe(200);
    expect((await call('/reset-password', { token: lastToken(email), newPassword: 'third password 33' })).status).toBe(400);

    const old = await call('/get-session', undefined, { cookie: oldCookie });
    expect(await old.json()).toBeNull();
    expect((await call('/sign-in/email', { email, password: 'first password 1' })).status).toBe(401);
    const signIn = await call('/sign-in/email', { email, password: 'second password 2' });
    expect(signIn.status).toBe(200);

    // смена пароля в настройках
    const cookie = cookieOf(signIn);
    expect((await call('/change-password', { currentPassword: 'second password 2', newPassword: 'fourth password 4', revokeOtherSessions: true }, { cookie })).status).toBe(200);
    expect((await call('/sign-out', {}, { cookie })).status).toBe(200);
  });

  it('limits sign-in attempts per address in the database', async () => {
    const headers = { 'cf-connecting-ip': '203.0.113.77' };
    const responses: Response[] = [];
    for (let i = 0; i < 6; i++) responses.push(await call('/sign-in/email', { email: 'brute@example.com', password: `guess number ${i}` }, headers));
    expect(responses.map((r) => r.status)).toEqual([401, 401, 401, 401, 401, 429]);
    // секунды до конца окна в минуту, а не склейка строки с числом
    const retry = Number(responses[5].headers.get('x-retry-after'));
    expect(retry).toBeGreaterThan(0);
    expect(retry).toBeLessThanOrEqual(60);
    // другой адрес не затронут
    expect((await call('/sign-in/email', { email: 'brute@example.com', password: 'guess' }, { 'cf-connecting-ip': '203.0.113.78' })).status).toBe(401);
    const rows = (await pool.query(`select key, count from "rateLimit" where key like '%203.0.113.77%'`)).rows;
    expect(rows.length).toBe(1);
  });

  it('checks the session far more often than the shared limit allows', async () => {
    const headers = { 'cf-connecting-ip': '203.0.113.90' };
    const statuses = new Set<number>();
    for (let i = 0; i < 150; i++) statuses.add((await call('/get-session', undefined, headers)).status);
    expect(statuses).toEqual(new Set([200]));
  });

  it('rejects cross-site requests from browsers and foreign origins with a cookie', async () => {
    const body = { email: 'x@example.com', password: 'whatever pass' };
    const crossSite = { origin: 'https://evil.example', 'sec-fetch-site': 'cross-site', 'sec-fetch-mode': 'cors', 'sec-fetch-dest': 'empty' };
    expect((await call('/sign-in/email', body, crossSite)).status).toBe(403);
    expect((await call('/sign-out', {}, { origin: 'https://evil.example', cookie: 'riftden.session_token=abc' })).status).toBe(403);
  });
});
