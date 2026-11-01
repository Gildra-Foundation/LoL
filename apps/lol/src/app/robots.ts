import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/i18n';

export default function robots(): MetadataRoute.Robots {
  return {
    // /design — внутренняя витрина дизайн-системы; аккаунт, избранное и API — личное, в поиске им делать нечего
    rules: process.env.SITE_PREVIEW === 'true'
      ? [{ userAgent: '*', disallow: '/' }]
      : [{ userAgent: '*', allow: '/', disallow: ['/design', '/account', '/en/account', '/favorites', '/en/favorites', '/api/'] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
