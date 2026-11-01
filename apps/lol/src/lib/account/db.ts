// Пул соединений с Postgres: один на процесс (в dev Next пересоздаёт модули — пул живёт в globalThis).
import pg, { Pool } from 'pg';
import { databaseUrl } from './config';

const INT8 = 20;

/**
 * bigint (int8) — числом, а не строкой: Better Auth хранит в rateLimit.lastRequest время в мс и складывает его
 * с окном — со строкой получается склейка и бессмысленный X-Retry-After. Время в мс помещается в Number без потерь.
 */
const types = {
  getTypeParser: ((oid: number, format?: 'text' | 'binary') =>
    oid === INT8 && format !== 'binary' ? (value: string) => Number(value) : pg.types.getTypeParser(oid, format)) as typeof pg.types.getTypeParser,
};

const store = globalThis as typeof globalThis & { __riftdenPool?: Pool };

export function getPool(): Pool {
  store.__riftdenPool ??= new Pool({ connectionString: databaseUrl(), max: 10, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000, types });
  return store.__riftdenPool;
}
