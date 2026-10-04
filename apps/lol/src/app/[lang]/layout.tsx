import type { Metadata, Viewport } from 'next';
import { Geologica, Tektur } from 'next/font/google';
import { notFound } from 'next/navigation';
import { LocaleProvider } from '@rift/engine/i18n/LocaleProvider';
import { Footer } from '@rift/engine/layout/Footer';
import { Header } from '@rift/engine/layout/Header';
import { SearchPalette } from '@rift/engine/layout/SearchPalette';
import { formatDate } from '@rift/engine/lib/format';
import { SITE_MARK, SITE_NAME, getSite } from '@/game/site';
import { getArticles } from '@/lib/articles';
import { DATA_VERSION } from '@/lib/assets';
import { CHAMPION_COUNT, UPDATED_AT } from '@/lib/champions';
import { SITE_URL, isLocale, langOf, localeParams, ogLocale } from '@/lib/i18n';
import '@rift/engine/styles/base.css';
import '@/styles/theme.css';

// Tektur — цифры, имена и заголовки (геометрия игрового интерфейса), Geologica — текст и подписи.
const tektur = Tektur({ subsets: ['latin', 'cyrillic'], axes: ['wdth'], variable: '--font-tektur', display: 'swap' });
const geologica = Geologica({ subsets: ['latin', 'cyrillic'], variable: '--font-geologica', display: 'swap' });

// сайт собирается целиком на каждом языке; других значений [lang] нет
export const dynamicParams = false;
export const generateStaticParams = localeParams;

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const lang = await langOf(params);
  const site = getSite(lang, { withArticles: false });
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: site.title, template: `%s — ${SITE_NAME}` },
    description: site.description,
    icons: { icon: '/favicon.svg' },
    openGraph: { siteName: SITE_NAME, type: 'website', ...ogLocale(lang) },
  };
}

export const viewport: Viewport = {
  themeColor: '#121a17',
  colorScheme: 'dark',
};

export default async function RootLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const site = getSite(lang, { withArticles: getArticles(lang).length > 0 });

  return (
    <html lang={lang} className={`${tektur.variable} ${geologica.variable}`}>
      <body>
        <LocaleProvider locale={lang}>
          <Header name={SITE_NAME} mark={SITE_MARK} nav={site.nav} {...site.header} />
          <main id="main">{children}</main>
          <Footer
            locale={lang}
            about={site.about(CHAMPION_COUNT, DATA_VERSION, formatDate(UPDATED_AT, lang))}
            links={site.footerLinks}
            sources={site.sources}
            legal={site.legal}
          />
          <SearchPalette sections={site.searchSections} {...site.search} />
        </LocaleProvider>
      </body>
    </html>
  );
}
