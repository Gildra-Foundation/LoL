// Загружает все образы, наборы и тематики на всех языках сайта: src/data/<язык>/skins.json и skin-sets.json.
//   • CommunityDragon (данные клиента игры) — образы, редкость, наборы, тематики, хромы, сплеши, видео. Обязательный.
//   • League of Legends Wiki, Module:SkinData — цена, дата выхода, доступность, актёры озвучки, художники,
//     что нового в образе. Только на английском, текст под CC BY-SA. Необязательный.
// Нужен уже скачанный champions.json (fetch-data.mjs): образы привязываются к чемпионам по ключу.
// Запуск: npm run update-data
import { readFile, writeFile } from 'node:fs/promises';
import { DATA, LOCALES, dataDir } from './locales.mjs';

const UA = { 'User-Agent': 'RiftDen data update (https://riftden.com)' };
const CD_ROOT = 'https://raw.communitydragon.org';
const CD = (patch, lang) => `${CD_ROOT}/${patch}/plugins/rcp-be-lol-game-data/global/${lang}/v1`;
const WIKI = 'https://wiki.leagueoflegends.com/en-us/Module:SkinData/data?action=raw';

async function get(url, { optional = false, text = false, retries = 3 } = {}) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: UA });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return text ? await res.text() : await res.json();
    } catch (err) {
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 800 * attempt));
        continue;
      }
      if (optional) {
        console.warn(`  ! пропущено ${url}: ${err.message}`);
        return null;
      }
      throw new Error(`${url}: ${err.message}`);
    }
  }
}

/** Таблица Lua из модуля вики: строки, числа, true/false/nil, списки и ["ключ"] = значение. */
export function parseLuaTable(source) {
  const body = source.slice(source.indexOf('return') + 6);
  let i = 0;
  const space = () => {
    for (;;) {
      while (/\s/.test(body[i])) i++;
      if (body.startsWith('--', i)) {
        while (i < body.length && body[i] !== '\n') i++;
      } else return;
    }
  };
  const string = () => {
    const quote = body[i++];
    let out = '';
    while (body[i] !== quote) {
      if (i >= body.length) throw new Error('Lua: незакрытая строка');
      if (body[i] === '\\') {
        const c = body[++i];
        out += c === 'n' ? '\n' : c === 't' ? '\t' : c;
        i++;
      } else out += body[i++];
    }
    i++;
    return out;
  };
  const value = () => {
    space();
    const c = body[i];
    if (c === '{') return table();
    if (c === '"' || c === "'") return string();
    const m = /^(-?\d+(?:\.\d+)?|true|false|nil)/.exec(body.slice(i, i + 32));
    if (!m) throw new Error(`Lua: неожиданный символ на ${i}: ${body.slice(i, i + 20)}`);
    i += m[0].length;
    return m[0] === 'true' ? true : m[0] === 'false' ? false : m[0] === 'nil' ? null : Number(m[0]);
  };
  const table = () => {
    i++; // {
    const list = [];
    const obj = {};
    let keyed = false;
    for (;;) {
      space();
      if (body[i] === '}') { i++; break; }
      if (body[i] === '[') {
        i++;
        space();
        const key = value();
        space();
        i++; // ]
        space();
        i++; // =
        obj[key] = value();
        keyed = true;
      } else list.push(value());
      space();
      if (body[i] === ',' || body[i] === ';') i++;
    }
    return keyed ? obj : list;
  };
  space();
  return value();
}

const slugify = (s) =>
  s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/&/g, ' and ').replace(/['’`.:]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Уникальные адреса: при совпадении — суффикс из id. */
function slugs(entries, base) {
  const used = new Set();
  const out = new Map();
  for (const e of entries) {
    let slug = base(e) || String(e.id);
    if (used.has(slug)) slug = `${slug}-${e.id}`;
    used.add(slug);
    out.set(e.id, slug);
  }
  return out;
}

/** Путь клиента «/lol-game-data/assets/ASSETS/…» → путь файла на CommunityDragon (в нижнем регистре). */
const asset = (p) => (p ? p.replace(/^\/lol-game-data\/assets\//i, '').toLowerCase() : null);

const cleanText = (s = '') =>
  s.replace(/<br\s*\/?>/gi, '\n').replace(/<\/?[a-z][^>]*>/gi, '').replace(/&nbsp;/g, ' ').replace(/[ \t]{2,}/g, ' ').trim();

/** Список возможностей ультимативного образа: <ul><li>…</li></ul> → строки. */
const featureList = (html) =>
  html ? [...html.matchAll(/<li>([\s\S]*?)<\/li>/gi)].map((m) => cleanText(m[1])).filter(Boolean) : [];

/** «Наследница Ари – ''День рождения''» / «Dynasty Ahri (Ahri-versary)» → «День рождения» / «Ahri-versary». */
function chromaLabel(name, parent) {
  let rest = name.startsWith(parent) ? name.slice(parent.length) : name;
  rest = rest.replace(/^[\s–—-]+/, '').replace(/^\((.*)\)$/, '$1').replace(/^''(.*)''$/, '$1').replace(/^"(.*)"$/, '$1').trim();
  return rest || name;
}

const COST_NOTES = { special: 'special', 'battle pass': 'pass', sanctum: 'sanctum' };
const RELEASE = /^\d{4}-\d{2}-\d{2}$/;

function wikiFacts(w) {
  if (!w) return null;
  const cost = typeof w.cost === 'number' ? w.cost : null;
  const note = typeof w.cost === 'string' ? COST_NOTES[w.cost.toLowerCase()] ?? null : null;
  const list = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : typeof v === 'string' ? [v] : []);
  return {
    availability: typeof w.availability === 'string' ? w.availability.toLowerCase() : null,
    cost,
    costNote: note,
    release: typeof w.release === 'string' && RELEASE.test(w.release) ? w.release : null,
    lootEligible: w.looteligible === true,
    voiceActors: list(w.voiceactor),
    splashArtists: list(w.splashartist),
    music: typeof w.music === 'string' && /^[\w-]{11}$/.test(w.music) ? w.music : null,
    new: {
      voice: w.newvoice === true,
      quotes: w.newquotes === true,
      effects: w.neweffects === true,
      animations: w.newanimations === true,
      recall: w.newrecall === true,
      transforming: w.transforming === true,
    },
  };
}

async function main() {
  const meta = JSON.parse(await readFile(new URL('meta.json', DATA), 'utf8'));
  const cdMeta = await get(`${CD_ROOT}/latest/content-metadata.json`);
  // адреса с номером патча не меняются, в отличие от latest
  const cdPatch = cdMeta.version.split('.').slice(0, 2).join('.');
  console.log(`CommunityDragon: патч ${cdPatch} (Data Dragon ${meta.version})`);

  const sources = await Promise.all(
    LOCALES.map(async (loc) => ({
      skins: await get(`${CD(cdPatch, loc.cd)}/skins.json`),
      lines: await get(`${CD(cdPatch, loc.cd)}/skinlines.json`),
      universes: await get(`${CD(cdPatch, loc.cd)}/universes.json`),
      champions: JSON.parse(await readFile(new URL('champions.json', dataDir(loc.code)), 'utf8')),
    })),
  );
  const english = sources[LOCALES.findIndex((l) => l.code === 'en')];

  console.log('League of Legends Wiki: цены, даты, озвучка…');
  const wikiRaw = await get(WIKI, { optional: true, text: true });
  const wiki = new Map(); // ключ чемпиона → номер образа → запись
  if (wikiRaw) {
    for (const champ of Object.values(parseLuaTable(wikiRaw))) {
      if (typeof champ?.id !== 'number') continue;
      const byNum = new Map();
      for (const skin of Object.values(champ.skins ?? {})) if (typeof skin?.id === 'number') byNum.set(skin.id, skin);
      wiki.set(champ.id, byNum);
    }
  }
  console.log(`  чемпионов в вики: ${wiki.size}`);

  // Все образы, включая вторые ступени многоступенчатых (их нет в корне skins.json).
  const flatten = (skins) => {
    const out = new Map();
    for (const s of Object.values(skins)) {
      out.set(s.id, s);
      for (const tier of s.questSkinInfo?.tiers ?? []) {
        if (tier.id !== s.id && !skins[tier.id]) out.set(tier.id, { ...s, ...tier, parent: s.id, chromas: [], questSkinInfo: undefined });
      }
    }
    return out;
  };
  const byLocale = sources.map((src) => flatten(src.skins));
  const enSkins = byLocale[LOCALES.findIndex((l) => l.code === 'en')];

  const champByKey = new Map(english.champions.map((c) => [c.key, c]));
  const known = [...enSkins.values()].filter((s) => champByKey.has(Math.floor(s.id / 1000)));
  const skinSlugs = slugs(
    known.toSorted((a, b) => a.id - b.id),
    (s) => (s.isBase ? `${champByKey.get(Math.floor(s.id / 1000)).slug}-original` : slugify(s.name)),
  );
  const lineSlugs = slugs(english.lines.filter((l) => l.id), (l) => slugify(l.name));
  const universeSlugs = slugs(english.universes, (u) => slugify(u.name));
  const universeOfLine = new Map();
  for (const u of english.universes) for (const id of u.skinSets) if (!universeOfLine.has(id)) universeOfLine.set(id, u.id);

  for (const [i, loc] of LOCALES.entries()) {
    const src = sources[i];
    const local = byLocale[i];
    const champs = new Map(src.champions.map((c) => [c.key, c]));
    const skins = known.map((en) => {
      const s = local.get(en.id) ?? en;
      const key = Math.floor(en.id / 1000);
      const num = en.id % 1000;
      const lines = (en.skinLines ?? []).map((l) => l.id).filter((id) => lineSlugs.has(id));
      const universes = [...new Set(lines.map((id) => universeOfLine.get(id)).filter((id) => id !== undefined))];
      const tiers = en.questSkinInfo?.tiers;
      return {
        id: en.id,
        champion: champs.get(key).id,
        num,
        slug: skinSlugs.get(en.id),
        name: s.isBase ? champs.get(key).name : s.name,
        base: Boolean(en.isBase),
        rarity: en.rarity && en.rarity !== 'kNoRarity' ? en.rarity : null,
        legacy: Boolean(en.isLegacy),
        ultimate: en.skinType === 'Ultimate',
        parent: en.parent ?? null,
        stages: tiers?.length > 1 ? tiers.map((t) => t.id) : null,
        lines,
        universes,
        description: cleanText(s.description ?? '') || null,
        features: featureList(s.featuresText),
        images: {
          splash: asset(en.splashPath),
          uncentered: asset(en.uncenteredSplashPath),
          tile: asset(en.tilePath),
          loading: asset(en.loadScreenPath),
          vintage: asset(en.loadScreenVintagePath),
        },
        video: {
          splash: asset(en.splashVideoPath ?? en.collectionSplashVideoPath),
          preview: typeof en.previewVideoUrl === 'string' ? en.previewVideoUrl : null,
          features: (local.get(en.id)?.skinFeaturePreviewData ?? en.skinFeaturePreviewData ?? [])
            .filter((f) => f.videoPath)
            .map((f) => ({ name: cleanText(f.description ?? ''), text: cleanText(f.longDescription ?? ''), icon: asset(f.iconPath), video: asset(f.videoPath) })),
        },
        chromas: (s.chromas ?? []).map((c) => ({
          id: c.id,
          name: chromaLabel(c.name, s.name),
          colors: (c.colors ?? []).filter((x) => /^#[0-9a-f]{6}$/i.test(x)),
          image: asset(c.chromaPath),
        })),
        ...wikiFacts(wiki.get(key)?.get(num)),
      };
    });
    // по чемпиону (алфавит языка), внутри — по номеру образа
    const champOrder = new Map(src.champions.map((c, idx) => [c.id, idx]));
    skins.sort((a, b) => champOrder.get(a.champion) - champOrder.get(b.champion) || a.num - b.num);

    const lineNames = new Map(src.lines.map((l) => [l.id, l]));
    const counts = new Map();
    for (const s of skins) for (const id of s.lines) counts.set(id, (counts.get(id) ?? 0) + 1);
    const lines = english.lines
      .filter((l) => lineSlugs.has(l.id) && counts.get(l.id))
      .map((l) => ({
        id: l.id,
        slug: lineSlugs.get(l.id),
        name: lineNames.get(l.id)?.name || l.name,
        description: cleanText(lineNames.get(l.id)?.description ?? l.description ?? '') || null,
        universe: universeOfLine.get(l.id) ?? null,
        count: counts.get(l.id),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, loc.code));
    const liveLines = new Set(lines.map((l) => l.id));
    const universeNames = new Map(src.universes.map((u) => [u.id, u]));
    const universes = english.universes
      .map((u) => ({
        id: u.id,
        slug: universeSlugs.get(u.id),
        name: universeNames.get(u.id)?.name || u.name,
        description: cleanText(universeNames.get(u.id)?.description ?? u.description ?? '') || null,
        lines: u.skinSets.filter((id) => liveLines.has(id)),
      }))
      .filter((u) => u.lines.length)
      .sort((a, b) => a.name.localeCompare(b.name, loc.code));

    await writeFile(new URL('skins.json', dataDir(loc.code)), JSON.stringify(skins));
    await writeFile(new URL('skin-sets.json', dataDir(loc.code)), JSON.stringify({ lines, universes }));
    if (i === 0) {
      const withWiki = skins.filter((s) => s.availability).length;
      console.log(`  образов: ${skins.length}, наборов: ${lines.length}, тематик: ${universes.length}, хром: ${skins.reduce((n, s) => n + s.chromas.length, 0)}, со сведениями вики: ${withWiki}`);
    }
  }

  meta.skins = { cdPatch, count: known.length, fetchedAt: new Date().toISOString(), wiki: wiki.size > 0 };
  await writeFile(new URL('meta.json', DATA), JSON.stringify(meta, null, 2) + '\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
