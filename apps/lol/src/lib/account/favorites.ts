// /api/favorites без привязки к Next (Request → Response), чтобы проверять тестами: GET — список, POST — добавить, DELETE — убрать.
import type { Pool } from 'pg';
import type { Limiter } from './rate-limit';
import { FAVORITES_MAX, isFavoriteKind, isFavoriteRef, type Favorite, type FavoriteKind } from './shared';

export type AddResult = 'added' | 'exists' | 'full';

export interface FavoritesStore {
  list(userId: string): Promise<Favorite[]>;
  add(userId: string, kind: FavoriteKind, ref: string): Promise<AddResult>;
  remove(userId: string, kind: FavoriteKind, ref: string): Promise<void>;
}

export interface FavoritesDeps {
  /** публичный адрес сайта: изменения принимаются только с него */
  origin: string;
  user(request: Request): Promise<{ id: string } | null>;
  store: FavoritesStore;
  /** лимиты: по адресу посетителя (до проверки сессии), на чтение и на запись по аккаунту */
  limits: { ip: Limiter; read: Limiter; write: Limiter };
}

const MAX_BODY = 1024;

const reply = (body: unknown, status = 200) =>
  new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

/** Запрос со своего сайта: Origin совпадает точно, а Sec-Fetch-Site (если браузер его шлёт) — same-origin. */
export function sameOrigin(request: Request, origin: string): boolean {
  if (request.headers.get('origin') !== origin) return false;
  const site = request.headers.get('sec-fetch-site');
  return site === null || site === 'same-origin';
}

export const clientIp = (request: Request) =>
  request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

async function readTarget(request: Request): Promise<{ kind: FavoriteKind; ref: string } | null> {
  if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) return null;
  const text = await request.text();
  if (text.length > MAX_BODY) return null;
  try {
    const body = JSON.parse(text) as unknown;
    if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
    const { kind, ref, ...rest } = body as Record<string, unknown>;
    if (Object.keys(rest).length || !isFavoriteKind(kind) || !isFavoriteRef(ref)) return null;
    return { kind, ref };
  } catch {
    return null;
  }
}

export async function handleFavorites(request: Request, deps: FavoritesDeps): Promise<Response> {
  const method = request.method.toUpperCase();
  if (!['GET', 'POST', 'DELETE'].includes(method)) return reply({ error: 'method-not-allowed' }, 405);
  const writing = method !== 'GET';
  if (writing && !sameOrigin(request, deps.origin)) return reply({ error: 'forbidden' }, 403);
  if (!deps.limits.ip.take(clientIp(request))) return reply({ error: 'rate-limited' }, 429);

  const target = writing ? await readTarget(request) : null;
  if (writing && !target) return reply({ error: 'invalid' }, 400);

  const user = await deps.user(request);
  if (!user) return reply({ error: 'unauthorized' }, 401);
  if (!(writing ? deps.limits.write : deps.limits.read).take(user.id)) return reply({ error: 'rate-limited' }, 429);

  if (!target) return reply({ favorites: await deps.store.list(user.id) });
  if (method === 'DELETE') {
    await deps.store.remove(user.id, target.kind, target.ref);
    return reply({ ok: true });
  }
  const result = await deps.store.add(user.id, target.kind, target.ref);
  if (result === 'full') return reply({ error: 'full', max: FAVORITES_MAX }, 409);
  return reply({ ok: true, ...target }, result === 'added' ? 201 : 200);
}

export function pgFavorites(pool: Pool): FavoritesStore {
  return {
    async list(userId) {
      const { rows } = await pool.query<{ kind: FavoriteKind; ref: string; created_at: Date }>(
        'select kind, ref, created_at from favorite where user_id = $1 order by created_at desc',
        [userId],
      );
      return rows.map((r) => ({ kind: r.kind, ref: r.ref, createdAt: r.created_at.toISOString() }));
    },
    async add(userId, kind, ref) {
      const inserted = await pool.query(
        `insert into favorite (user_id, kind, ref)
         select $1, $2, $3 where (select count(*) from favorite where user_id = $1) < $4
         on conflict do nothing returning 1`,
        [userId, kind, ref, FAVORITES_MAX],
      );
      if (inserted.rowCount) return 'added';
      const exists = await pool.query('select 1 from favorite where user_id = $1 and kind = $2 and ref = $3', [userId, kind, ref]);
      return exists.rowCount ? 'exists' : 'full';
    },
    async remove(userId, kind, ref) {
      await pool.query('delete from favorite where user_id = $1 and kind = $2 and ref = $3', [userId, kind, ref]);
    },
  };
}
