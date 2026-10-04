// Языки сайта: всё из движка плюс помощники для страниц.
import type { Metadata } from 'next';
import { DEFAULT_LOCALE, LOCALES, OG_LOCALE, isLocale, localePath, type Locale } from '@rift/engine/i18n/locale';

export { DEFAULT_LOCALE, LOCALES, LOCALE_NAME, LOCALE_TAG, OG_LOCALE, defineMessages, isLocale, localePath, stripLocale } from '@rift/engine/i18n/locale';
export type { Locale, Messages } from '@rift/engine/i18n/locale';

/** Язык из параметров маршрута [lang]; неизвестный — основной. */
export async function langOf(params: Promise<{ lang: string }>): Promise<Locale> {
  const { lang } = await params;
  return isLocale(lang) ? lang : DEFAULT_LOCALE;
}

/** Параметры для generateStaticParams: страница собирается на каждом языке. */
export const localeParams = () => LOCALES.map((lang) => ({ lang }));

/** Адрес сайта для канонических ссылок и Open Graph; на сервере задаётся переменной окружения. */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/** Каноническая ссылка и версии страницы на других языках: path — без префикса языка. */
export function alternates(lang: Locale, path: string): Metadata['alternates'] {
  return {
    canonical: localePath(lang, path),
    languages: { ...Object.fromEntries(LOCALES.map((l) => [l, localePath(l, path)])), 'x-default': localePath(DEFAULT_LOCALE, path) },
  };
}

/** Open Graph с языком страницы. */
export const ogLocale = (lang: Locale) => ({ locale: OG_LOCALE[lang], alternateLocale: LOCALES.filter((l) => l !== lang).map((l) => OG_LOCALE[l]) });
