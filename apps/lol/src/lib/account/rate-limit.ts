// Скользящее окно в памяти процесса — для /api/favorites (сайт работает одним контейнером).
export interface Limiter {
  /** true — запрос можно выполнить; false — лимит исчерпан до конца окна. */
  take(key: string, now?: number): boolean;
}

export function createLimiter(max: number, windowMs: number, maxKeys = 10_000): Limiter {
  const hits = new Map<string, number[]>();
  return {
    take(key, now = Date.now()) {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      if (recent.length >= max) {
        hits.set(key, recent);
        return false;
      }
      recent.push(now);
      hits.delete(key);
      hits.set(key, recent);
      // самые давние ключи вытесняются, чтобы память не росла от перебора адресов
      if (hits.size > maxKeys) hits.delete(hits.keys().next().value!);
      return true;
    },
  };
}
