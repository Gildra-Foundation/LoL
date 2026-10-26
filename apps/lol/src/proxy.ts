import { NextResponse, type NextRequest } from 'next/server';
import { DEFAULT_LOCALE, isLocale } from '@/lib/i18n';

/**
 * Цель rewrite/redirect строится от request.url — того же адреса, что видит роутер Next
 * (адрес и порт сервера, протокол из X-Forwarded-Proto). Тогда Next считает rewrite внутренним
 * и делает Location относительным — за пробросом портов и обратным прокси тоже. У request.nextUrl
 * origin другой (localhost:PORT): rewrite туда Next выполняет как внешний запрос, прокси снова
 * получает /ru/... и отвечает 308 на тот же адрес (петля), а через https-прокси — 500.
 */
const sameOrigin = (request: NextRequest) => {
  const url = new URL(request.url);
  url.search = request.nextUrl.search;
  return url;
};

/**
 * Адреса основного языка — без префикса: /champions отдаётся страницей /ru/champions, а /ru/champions
 * перенаправляется на /champions, чтобы у страницы был один адрес. Остальные языки — с префиксом: /en/champions.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const first = pathname.split('/')[1];

  if (first === DEFAULT_LOCALE) {
    const url = sameOrigin(request);
    url.pathname = pathname.slice(DEFAULT_LOCALE.length + 1) || '/';
    return NextResponse.redirect(url, 308);
  }
  if (isLocale(first)) return NextResponse.next();

  const url = sameOrigin(request);
  url.pathname = `/${DEFAULT_LOCALE}${pathname === '/' ? '' : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // служебные файлы Next и файлы из public не трогаем
  matcher: ['/((?!_next/|favicon\\.svg|robots\\.txt|sitemap\\.xml|metrics(?:/|$)|health\\.json|riot\\.txt).*)'],
};
