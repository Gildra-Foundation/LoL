// Общее для клиента и сервера: виды избранного, проверка ссылок, требования к паролю.

export const FAVORITE_KINDS = ['skin', 'skinline', 'universe', 'champion'] as const;
export type FavoriteKind = (typeof FAVORITE_KINDS)[number];

export interface Favorite {
  kind: FavoriteKind;
  ref: string;
  createdAt: string;
}

export const isFavoriteKind = (value: unknown): value is FavoriteKind => FAVORITE_KINDS.includes(value as FavoriteKind);

/** Ссылка на объект избранного: id скина (103086) или слаг (star-guardian, ahri). */
export const isFavoriteRef = (value: unknown): value is string => typeof value === 'string' && /^[a-z0-9][a-z0-9_-]{0,79}$/i.test(value);

/** Сколько всего можно держать в избранном одному аккаунту. */
export const FAVORITES_MAX = 2000;

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

/** Событие «открыть окно входа» — кнопка избранного и меню аккаунта открывают одно и то же окно. */
export const OPEN_AUTH_EVENT = 'rd:auth';
export const openAuthDialog = (mode: 'sign-in' | 'sign-up' = 'sign-in') => window.dispatchEvent(new CustomEvent(OPEN_AUTH_EVENT, { detail: mode }));
