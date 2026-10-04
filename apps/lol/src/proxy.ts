import { NextResponse, type NextRequest } from 'next/server';
import { DEFAULT_LOCALE, isLocale } from '@/lib/i18n';

/**
 * Адреса основного языка — без префикса: /champions отдаётся страницей /ru/champions, а /ru/champions
 * перенаправляется на /champions, чтобы у страницы был один адрес. Остальные языки — с префиксом: /en/champions.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const first = pathname.split('/')[1];

  if (first === DEFAULT_LOCALE) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(DEFAULT_LOCALE.length + 1) || '/';
    return NextResponse.redirect(url, 308);
  }
  if (isLocale(first)) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = `/${DEFAULT_LOCALE}${pathname === '/' ? '' : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // служебные файлы Next и файлы из public не трогаем
  matcher: ['/((?!_next/|favicon\\.svg|robots\\.txt|sitemap\\.xml|riot\\.txt).*)'],
};
