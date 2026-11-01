import type { Metadata, Viewport } from 'next';
import { Geologica, Tektur } from 'next/font/google';
import { notFound } from 'next/navigation';
import { LocaleProvider } from '@rift/engine/i18n/LocaleProvider';
import { Footer } from '@rift/engine/layout/Footer';
import { Header } from '@rift/engine/layout/Header';
import { SearchPalette } from '@rift/engine/layout/SearchPalette';
import { formatDate } from '@rift/engine/lib/format';
import { AccountMenu } from '@/components/account/AccountMenu';
import { AccountProvider } from '@/components/account/AccountProvider';
import { Plausible } from '@/components/observability/Plausible';
import { SiteMetrics } from '@/components/observability/SiteMetrics';
import { JsonLd } from '@/components/seo/JsonLd';
import { SITE_MARK, SITE_NAME, getSite } from '@/game/site';
import { DATA_VERSION } from '@/lib/assets';
import { CHAMPION_COUNT, UPDATED_AT } from '@/lib/champions';
import { SITE_URL, isLocale, langOf, localeParams, ogLocale } from '@/lib/i18n';
import '@rift/engine/styles/base.css';
import '@/styles/theme.css';

// Tektur — цифры, имена и заголовки (геометрия игрового интерфейса), Geologica — текст и подписи.
const tektur = Tektur({ subsets: ['latin', 'cyrillic'], axes: ['wdth'], variable: '--font-tektur', display: 'swap' });
const geologica = Geologica({ subsets: ['latin', 'cyrillic'], variable: '--font-geologica', display: 'swap' });

// сайт собирается на каждом языке; других значений [lang] нет — неизвестный язык отдаёт 404 ниже.
// dynamicParams здесь не выключается: в Next 16 false на любом сегменте запрещает и вложенным
// маршрутам открывать новые адреса.
// Страницы чемпионов и регионов сами держат dynamicParams = false.
export const generateStaticParams = localeParams;

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const lang = await langOf(params);
  const site = getSite(lang);
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: site.title, template: `%s — ${SITE_NAME}` },
    description: site.description,
    icons: { icon: '/favicon.svg' },
    robots: process.env.SITE_PREVIEW === 'true' ? { index: false, follow: false } : undefined,
    twitter: { card: 'summary' },
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
  const site = getSite(lang);

  return (
    <html lang={lang} className={`${tektur.variable} ${geologica.variable}`}>
      <body>
        <LocaleProvider locale={lang}>
          <AccountProvider>
          <a className="skip-link" href="#main">{lang === 'ru' ? 'Перейти к содержимому' : 'Skip to content'}</a>
          <Header name={SITE_NAME} mark={SITE_MARK} nav={site.nav} {...site.header} actions={<AccountMenu />} />
          <JsonLd data={{ '@context': 'https://schema.org', '@type': 'WebSite', name: SITE_NAME, url: SITE_URL, inLanguage: lang, description: site.description }} />
          <main id="main">{children}</main>
          <Footer
            locale={lang}
            about={site.about(CHAMPION_COUNT, DATA_VERSION, formatDate(UPDATED_AT, lang))}
            links={site.footerLinks}
            sources={site.sources}
            legal={site.legal}
          />
          <SiteMetrics />
          <Plausible />
          <SearchPalette sections={site.searchSections} {...site.search} />
          </AccountProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
