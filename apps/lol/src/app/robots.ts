import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/i18n';

export default function robots(): MetadataRoute.Robots {
  return {
    // /design — внутренняя витрина дизайн-системы
    rules: [{ userAgent: '*', allow: '/', disallow: ['/design'] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
