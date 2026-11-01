// Настройки аккаунтов из окружения сервера: читаются при запросе, а не при сборке — образ один для staging и прода.
import { SITE_URL } from '@/lib/i18n';

/**
 * Публичный адрес сайта, с которого приходят запросы к /api: от него строятся ссылки в письмах,
 * проверка Origin и флаг Secure у cookie. NEXT_PUBLIC_SITE_URL вшивается при сборке,
 * поэтому staging и тесты задают свой адрес в BETTER_AUTH_URL.
 */
export const authOrigin = () => new URL(process.env.BETTER_AUTH_URL || SITE_URL).origin;

/** Cookie с флагом Secure — когда сайт открыт по https. */
export const secureCookies = () => authOrigin().startsWith('https://');

export const databaseUrl = () => process.env.DATABASE_URL || '';

/** Аккаунты работают, только если есть база и секрет; иначе /api/auth и /api/favorites отвечают 503. */
export const accountsConfigured = () => Boolean(databaseUrl() && process.env.BETTER_AUTH_SECRET);

/** Cloudflare Turnstile: включается секретом на сервере, ключ сайта отдаётся форме через /api/account-config. */
export const turnstile = () => {
  const secretKey = process.env.TURNSTILE_SECRET_KEY || '';
  const siteKey = process.env.TURNSTILE_SITE_KEY || '';
  return secretKey && siteKey ? { secretKey, siteKey } : null;
};

/** Встроенные лимиты попыток выключаются только явно (локальные проверки). */
export const rateLimitEnabled = () => process.env.AUTH_RATE_LIMIT !== 'off';
