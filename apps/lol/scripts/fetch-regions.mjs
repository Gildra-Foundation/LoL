// Регионы Рунтерры и лор чемпионов из Universe Riot — на всех языках сайта.
// regions.json — регионы для карты; region-pages.json — галереи и рассказы для страниц регионов;
// lore.json — биографии, цитаты, связи и рассказы чемпионов.
// Запускается после fetch-data.mjs: чемпионы сопоставляются с src/data/<язык>/champions.json.
import { readFile, writeFile } from 'node:fs/promises';
import { LOCALES, dataDir } from './locales.mjs';

const [BASE] = LOCALES;
const UNIVERSE = (loc) => `https://universe-meeps.leagueoflegends.com/v1/${loc.universe}`;
const SITE = 'https://universe.leagueoflegends.com';
const TEXTS = { ru: { gallery: 'Галерея' }, en: { gallery: 'Gallery' } };

async function get(url, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return await res.json();
    } catch (e) {
      if (i >= tries) throw e;
      await new Promise((r) => setTimeout(r, 1000 * i));
    }
  }
}

/** Параллельно, но не больше limit запросов сразу. */
async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

const norm = (s) =>
  s
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]/g, '');

// текст — только абзацы, без разметки; абзацы в Universe разделены то </p>, то одним <p>
const paragraphs = (html = '') =>
  html
    .split(/<\/?p[^>]*>|<br\s*\/?>/i)
    .map((p) =>
      p
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean);

const unquote = (s) =>
  s
    .trim()
    .replace(/^(?:''|["“”«»„'])+/, '')
    .replace(/(?:''|["“”«»„'])+\.?$/, '')
    .trim();

// ссылки Universe бывают относительными и с локалью в разном регистре
const siteUrl = (loc, url = '') => {
  if (/^https?:/.test(url)) return url;
  return SITE + url.replace(new RegExp(`^/${loc.universe}/`, 'i'), `/${loc.site}/`);
};

const readChampions = async (code) => JSON.parse(await readFile(new URL('champions.json', dataDir(code)), 'utf8'));

// ── Сопоставление с чемпионами патча — по основному языку ──
const champions = await readChampions(BASE.code);
const byName = new Map(champions.map((c) => [norm(c.name), c]));
const byKey = new Map(champions.flatMap((c) => [[norm(c.id), c], [norm(c.slug), c]]));
const match = (u) => byName.get(norm(u.name ?? '')) ?? byKey.get(norm(u.slug ?? ''));

const search = await get(`${UNIVERSE(BASE)}/search/index.json`);
const members = new Map();
const unmatched = [];
const known = [];
for (const u of search.champions) {
  const c = match(u);
  if (!c) {
    unmatched.push(u.name);
    continue;
  }
  known.push({ universe: u.slug, id: c.id });
  const region = u['associated-faction-slug'] || 'unaffiliated';
  members.set(region, [...(members.get(region) ?? []), c.id]);
}

// связи — по основному языку: имена связанных чемпионов сопоставляются так же
const related = {};
const summary = [];

for (const loc of LOCALES) {
  const local = await readChampions(loc.code);
  const nameOf = new Map(local.map((c) => [c.id, c.name]));
  const sorted = (ids = []) => [...ids].sort((a, b) => (nameOf.get(a) ?? a).localeCompare(nameOf.get(b) ?? b, loc.code));
  const index = loc === BASE ? search : await get(`${UNIVERSE(loc)}/search/index.json`);
  // адрес чемпиона в Universe на этом языке: в русском индексе встречаются кириллические (Тимо), английский их не знает
  const localByName = new Map(local.map((c) => [norm(c.name), c.id]));
  const slugOf = new Map(
    index.champions.map((u) => [localByName.get(norm(u.name ?? '')) ?? byKey.get(norm(u.slug ?? ''))?.id, u.slug]).filter(([id]) => id),
  );

  // ── Регионы ──
  const regions = [];
  const pages = {};
  await pool(index.factions, 4, async (f) => {
    const data = await get(`${UNIVERSE(loc)}/factions/${f.slug}/index.json`);
    const { faction, modules = [] } = data;
    regions.push({
      slug: f.slug,
      name: f.name,
      text: paragraphs(faction.overview?.short ?? f.description),
      image: faction.image?.uri ?? null,
      video: faction.video?.uri ?? null,
      champions: sorted(members.get(f.slug)),
    });
    pages[f.slug] = {
      galleries: modules
        .filter((m) => m.type === 'image-gallery' && !m.isFanArt)
        .map((m) => ({
          title: m['section-title'] || m.title || TEXTS[loc.code].gallery,
          images: (m.assets ?? [])
            .filter((a) => a.uri)
            .map((a) => ({ title: a.title ?? '', description: paragraphs(a.description).join(' '), uri: a.uri, width: a.width ?? null, height: a.height ?? null })),
        }))
        .filter((g) => g.images.length > 0),
      stories: modules
        .filter((m) => (m.type === 'link-out' && !m.isFanArt && m.url) || m.type === 'story-preview')
        .map((m) => ({ title: m.title, kind: m.isComic ? 'comic' : 'story', url: siteUrl(loc, m.url) })),
    };
  });
  regions.sort((a, b) => a.name.localeCompare(b.name, loc.code));

  // ── Лор чемпионов ──
  const lore = {};
  await pool(known, 6, async ({ universe, id }) => {
    const data = await get(`${UNIVERSE(loc)}/champions/${slugOf.get(id) ?? universe}/index.json`);
    const c = data.champion ?? {};
    const bio = c.biography ?? {};
    if (loc === BASE) {
      related[id] = (data['related-champions'] ?? []).map((r) => match(r)?.id).filter((other) => other && other !== id);
    }
    lore[id] = {
      bio: paragraphs(bio.short),
      // цитаты обёрнуты в '' или кавычки, иногда с точкой после — кавычки ставит вёрстка
      quote: unquote(paragraphs(bio.quote).join(' ')),
      quoteAuthor: bio['quote-author'] || null,
      races: (c.races ?? []).map((r) => r.name).filter(Boolean),
      related: related[id] ?? [],
      stories: (data.modules ?? [])
        .filter((m) => m.type === 'story-preview' && m.url)
        .map((m) => ({ title: m.title, url: siteUrl(loc, m.url), minutes: m['minutes-to-read'] ?? null })),
    };
  });

  const dir = dataDir(loc.code);
  await writeFile(new URL('regions.json', dir), JSON.stringify({ regions, unaffiliated: sorted(members.get('unaffiliated')) }));
  await writeFile(new URL('region-pages.json', dir), JSON.stringify(pages));
  await writeFile(new URL('lore.json', dir), JSON.stringify(lore));
  summary.push(
    `${loc.code}: регионов ${regions.length}, галерей ${Object.values(pages).reduce((n, p) => n + p.galleries.length, 0)}, рассказов регионов ${Object.values(pages).reduce((n, p) => n + p.stories.length, 0)}, лор ${Object.keys(lore).length}`,
  );
}

const links = Object.values(related).reduce((n, l) => n + l.length, 0);
console.log(summary.join('\n'));
console.log(`Без региона: ${members.get('unaffiliated')?.length ?? 0}. Связей: ${links}.`);
if (unmatched.length) console.log(`Нет в данных патча: ${unmatched.join(', ')}.`);
