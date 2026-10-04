// Статьи о LoL: папка src/content/articles/<язык>, категории и обложки из артов чемпионов. Только для сервера.
import 'server-only';
import path from 'node:path';
import { createArticleStore } from '@rift/engine/articles/store';
import { img } from './assets';
import { LOCALES, type Locale } from './i18n';

export const CATEGORIES = {
  ru: ['Механики', 'Макро', 'Новичкам', 'Аналитика'],
  en: ['Mechanics', 'Macro', 'Beginners', 'Analytics'],
} as const satisfies Record<Locale, readonly string[]>;

const AUTHOR: Record<Locale, string> = { ru: 'Редакция RiftDen', en: 'RiftDen editors' };

type Cover = { champion: string; skin: number };

const readCover = (data: Record<string, unknown>): Cover => {
  const c = (data.cover ?? {}) as Partial<Cover>;
  return { champion: String(c.champion), skin: c.skin ?? 0 };
};

const storeFor = (lang: Locale) =>
  createArticleStore({
    dir: path.join(process.cwd(), 'src', 'content', 'articles', lang),
    categories: CATEGORIES[lang],
    defaultAuthor: AUTHOR[lang],
    coverUrl: (data) => {
      const cover = readCover(data);
      return img.centered(cover.champion, cover.skin);
    },
    // обложка — арт чемпиона, champions — кого статья упоминает
    extend: (data) => ({
      cover: readCover(data),
      champions: Array.isArray(data.champions) ? data.champions.map(String) : [],
    }),
  });

const stores = Object.fromEntries(LOCALES.map((lang) => [lang, storeFor(lang)])) as Record<Locale, ReturnType<typeof storeFor>>;

export const getArticles = (lang: Locale) => stores[lang].getArticles();
export const getArticle = (slug: string, lang: Locale) => stores[lang].getArticle(slug);
export type Article = ReturnType<typeof getArticles>[number];
