import type { Metadata } from 'next';
import Link from '@rift/engine/i18n/Link';
import { notFound } from 'next/navigation';
import { plural } from '@rift/engine/lib/format';
import { SkinSetPage } from '@/components/skins/SkinSetPage';
import { DEFAULT_LOCALE, alternates, defineMessages, langOf, ogLocale } from '@/lib/i18n';
import { cdAsset, lineHref, universeHref } from '@/lib/skin-assets';
import { getLine, getUniverseBySlug, getUniverses, skinsOfUniverse } from '@/lib/skins';
import styles from '../../skins.module.css';

const MESSAGES = defineMessages({
  ru: {
    metaTitle: (name: string) => `Тематика «${name}»: все наборы и образы`,
    metaDescription: (name: string, lines: number, n: number) =>
      `Тематика «${name}» в League of Legends: ${lines} ${plural(lines, ['набор', 'набора', 'наборов'], 'ru')} и ${n} ${plural(n, ['образ', 'образа', 'образов'], 'ru')} со сплэш-артами, ценами и датами выхода.`,
    skins: 'Образы',
    lines: 'Наборы тематики',
    list: (n: number) => `${n} ${plural(n, ['образ', 'образа', 'образов'], 'ru')}`,
    catalog: 'В каталоге с фильтрами',
  },
  en: {
    metaTitle: (name: string) => `${name} universe: all skin lines and skins`,
    metaDescription: (name: string, lines: number, n: number) =>
      `The ${name} universe in League of Legends: ${lines} skin ${plural(lines, ['line', 'lines', 'lines'], 'en')} and ${n} ${plural(n, ['skin', 'skins', 'skins'], 'en')} with splash art, prices and release dates.`,
    skins: 'Skins',
    lines: 'Skin lines',
    list: (n: number) => `${n} ${plural(n, ['skin', 'skins', 'skins'], 'en')}`,
    catalog: 'Open in the catalog',
  },
});

export const dynamicParams = false;
export const generateStaticParams = () => getUniverses(DEFAULT_LOCALE).map((u) => ({ slug: u.slug }));

type Params = { params: Promise<{ lang: string; slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const lang = await langOf(params);
  const u = getUniverseBySlug(slug, lang);
  if (!u) return {};
  const skins = skinsOfUniverse(u.id, lang);
  const cover = skins.find((s) => s.images.splash);
  return {
    title: MESSAGES[lang].metaTitle(u.name),
    description: MESSAGES[lang].metaDescription(u.name, u.lines.length, skins.length),
    alternates: alternates(lang, universeHref(u.slug)),
    openGraph: { images: cover ? [cdAsset(cover.images.splash!)] : [], ...ogLocale(lang) },
  };
}

export default async function UniversePage({ params }: Params) {
  const { slug } = await params;
  const lang = await langOf(params);
  const u = getUniverseBySlug(slug, lang);
  if (!u) notFound();
  const t = MESSAGES[lang];
  const skins = skinsOfUniverse(u.id, lang);
  const lines = u.lines.map((id) => getLine(id, lang)).filter((l) => l !== undefined);
  return (
    <SkinSetPage
      lang={lang}
      crumbs={[
        { name: t.skins, path: '/skins' },
        { name: u.name, path: universeHref(u.slug) },
      ]}
      title={u.name}
      lead={u.description}
      skins={skins}
      listTitle={t.list(skins.length)}
      catalogHref={`/skins?universe=${u.slug}`}
      catalogLabel={t.catalog}
    >
      {lines.length > 1 && (
        <section className={styles.block}>
          <h2 className={styles.h2}>{t.lines}</h2>
          <ul className={styles.sets} role="list">
            {lines.map((l) => (
              <li key={l.id}>
                <Link href={lineHref(l.slug)}>
                  <span>{l.name}</span>
                  <span className="num">{l.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </SkinSetPage>
  );
}
