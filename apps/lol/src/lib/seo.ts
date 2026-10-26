import { SITE_URL, localePath, type Locale } from './i18n';
export function breadcrumbData(lang: Locale, items: { name: string; path: string }[]) {
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map((item, i) => ({
    '@type': 'ListItem', position: i + 1, name: item.name, item: new URL(localePath(lang, item.path), SITE_URL).href,
  })) };
}
