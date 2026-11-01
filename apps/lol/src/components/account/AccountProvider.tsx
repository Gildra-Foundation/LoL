'use client';

import { createContext, use, useCallback, useEffect, useMemo, useState } from 'react';
import { api, favoriteKey, type SessionUser } from '@/lib/account/client';
import { OPEN_AUTH_EVENT, type Favorite, type FavoriteKind } from '@/lib/account/shared';
import { AuthDialog } from './AuthDialog';

export type AccountStatus = 'loading' | 'disabled' | 'guest' | 'user';

interface AccountContextValue {
  status: AccountStatus;
  user: SessionUser | null;
  /** избранное вошедшего: null — ещё не загружено */
  favorites: Map<string, Favorite> | null;
  refresh(): Promise<void>;
  /** перечитать избранное с сервера (страница /favorites — вдруг добавляли с другого устройства) */
  reloadFavorites(): Promise<void>;
  /** true — объект теперь в избранном; null — не получилось (ошибка показана кнопкой) */
  toggleFavorite(kind: FavoriteKind, ref: string): Promise<boolean | null>;
  openAuth(mode?: 'sign-in' | 'sign-up'): void;
}

const AccountContext = createContext<AccountContextValue | null>(null);

export function useAccount(): AccountContextValue {
  const value = use(AccountContext);
  if (!value) throw new Error('useAccount outside AccountProvider');
  return value;
}

/**
 * Сессия и избранное посетителя на всех страницах: страницы статические, поэтому всё узнаётся запросом из браузера
 * после загрузки. Здесь же живёт окно входа — его открывают кнопка в шапке и кнопки избранного.
 */
export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AccountStatus>('loading');
  const [user, setUser] = useState<SessionUser | null>(null);
  const [favorites, setFavorites] = useState<Map<string, Favorite> | null>(null);
  const [dialog, setDialog] = useState<'sign-in' | 'sign-up' | null>(null);

  const loadFavorites = useCallback(async () => {
    const result = await api.favorites();
    if (result.ok && result.data) setFavorites(new Map(result.data.favorites.map((f) => [favoriteKey(f.kind, f.ref), f])));
  }, []);

  const refresh = useCallback(async () => {
    const result = await api.session();
    if (result.status === 503) {
      setStatus('disabled');
      return;
    }
    const sessionUser = result.ok ? (result.data?.user ?? null) : null;
    setUser(sessionUser);
    setStatus(sessionUser ? 'user' : 'guest');
    if (sessionUser) await loadFavorites();
    else setFavorites(null);
  }, [loadFavorites]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openAuth = useCallback((mode: 'sign-in' | 'sign-up' = 'sign-in') => setDialog(mode), []);

  useEffect(() => {
    const onOpen = (e: Event) => openAuth((e as CustomEvent<'sign-in' | 'sign-up'>).detail);
    window.addEventListener(OPEN_AUTH_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_AUTH_EVENT, onOpen);
  }, [openAuth]);

  const toggleFavorite = useCallback(
    async (kind: FavoriteKind, ref: string) => {
      const key = favoriteKey(kind, ref);
      const had = favorites?.has(key) ?? false;
      // сразу показываем результат, при ошибке возвращаем как было
      const apply = (on: boolean) =>
        setFavorites((current) => {
          const next = new Map(current ?? []);
          if (on) next.set(key, { kind, ref, createdAt: new Date().toISOString() });
          else next.delete(key);
          return next;
        });
      apply(!had);
      const result = had ? await api.removeFavorite(kind, ref) : await api.addFavorite(kind, ref);
      if (result.ok) return !had;
      apply(had);
      if (result.status === 401) await refresh();
      return null;
    },
    [favorites, refresh],
  );

  const value = useMemo(
    () => ({ status, user, favorites, refresh, reloadFavorites: loadFavorites, toggleFavorite, openAuth }),
    [status, user, favorites, refresh, loadFavorites, toggleFavorite, openAuth],
  );

  return (
    <AccountContext value={value}>
      {children}
      {dialog && <AuthDialog mode={dialog} onClose={() => setDialog(null)} />}
    </AccountContext>
  );
}
