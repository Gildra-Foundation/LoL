// Схема базы аккаунтов. Миграции применяются по порядку при запуске сервера (instrumentation.ts) под advisory-lock,
// каждая — в своей транзакции; применённые записываются в riftden_migration. Менять применённую миграцию нельзя — только добавлять новую.
import type { Pool } from 'pg';

export interface Migration {
  id: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    // таблицы Better Auth 1.7 (вывод getMigrations для emailAndPassword + rateLimit.storage = database)
    id: '0001_better_auth',
    sql: `
create table "user" ("id" text not null primary key, "name" text not null, "email" text not null unique, "emailVerified" boolean not null, "image" text, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz default CURRENT_TIMESTAMP not null);
create table "session" ("id" text not null primary key, "expiresAt" timestamptz not null, "token" text not null unique, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz not null, "ipAddress" text, "userAgent" text, "userId" text not null references "user" ("id") on delete cascade);
create table "account" ("id" text not null primary key, "accountId" text not null, "providerId" text not null, "userId" text not null references "user" ("id") on delete cascade, "accessToken" text, "refreshToken" text, "idToken" text, "accessTokenExpiresAt" timestamptz, "refreshTokenExpiresAt" timestamptz, "scope" text, "password" text, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz not null);
create table "verification" ("id" text not null primary key, "identifier" text not null, "value" text not null, "expiresAt" timestamptz not null, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz default CURRENT_TIMESTAMP not null);
create table "rateLimit" ("id" text not null primary key, "key" text not null unique, "count" integer not null, "lastRequest" bigint not null);
create index "session_userId_idx" on "session" ("userId");
create index "account_userId_idx" on "account" ("userId");
create index "verification_identifier_idx" on "verification" ("identifier");
`,
  },
  {
    id: '0002_favorite',
    sql: `
create table favorite (
  user_id text not null references "user" ("id") on delete cascade,
  kind text not null check (kind in ('skin', 'skinline', 'universe', 'champion')),
  ref text not null check (char_length(ref) between 1 and 80),
  created_at timestamptz not null default now(),
  primary key (user_id, kind, ref)
);
`,
  },
];

/** Номер advisory-lock: несколько контейнеров с одной базой не применяют миграции одновременно. */
const LOCK = 7_340_211;

export async function migrate(pool: Pool, migrations: Migration[] = MIGRATIONS): Promise<string[]> {
  const client = await pool.connect();
  const applied: string[] = [];
  try {
    await client.query('select pg_advisory_lock($1)', [LOCK]);
    await client.query('create table if not exists riftden_migration (id text primary key, applied_at timestamptz not null default now())');
    const done = new Set((await client.query<{ id: string }>('select id from riftden_migration')).rows.map((r) => r.id));
    for (const m of migrations) {
      if (done.has(m.id)) continue;
      await client.query('begin');
      try {
        await client.query(m.sql);
        await client.query('insert into riftden_migration (id) values ($1)', [m.id]);
        await client.query('commit');
        applied.push(m.id);
      } catch (error) {
        await client.query('rollback');
        throw new Error(`migration ${m.id} failed: ${(error as Error).message}`, { cause: error });
      }
    }
  } finally {
    await client.query('select pg_advisory_unlock($1)', [LOCK]).catch(() => undefined);
    client.release();
  }
  return applied;
}

/** Уборка просроченного: сессии, токены, счётчики лимитов старше суток. */
export async function cleanup(pool: Pool): Promise<void> {
  await pool.query('delete from "session" where "expiresAt" < now()');
  await pool.query('delete from "verification" where "expiresAt" < now()');
  await pool.query('delete from "rateLimit" where "lastRequest" < $1', [Date.now() - 24 * 3600 * 1000]);
}
