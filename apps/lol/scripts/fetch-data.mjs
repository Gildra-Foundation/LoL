// Загружает данные о чемпионах на всех языках сайта и сохраняет их в src/data/<язык>/champions.json.
//   • Data Dragon (официальный CDN Riot) — характеристики, умения, советы, образы. Обязательный источник.
//   • CommunityDragon — стиль игры, тип урона, редкость образов, видео умений. Необязательный.
//   • Игровые файлы CommunityDragon (.bin.json) — прирост силы атаки и коэффициент скорости атаки:
//     в Data Dragon начиная с 16.5 прирост силы атаки у всех чемпионов ошибочно равен 0.
//   • Meraki Analytics — основные позиции и дата выхода. Необязательный.
// Запуск: npm run update-data
import { mkdir, writeFile } from 'node:fs/promises';
import { DATA, LOCALES, dataDir } from './locales.mjs';

const DD = 'https://ddragon.leagueoflegends.com';
// CommunityDragon: стиль игры, редкость образов, видео — общие; метки стиля (Взрывной / Burst) — на языке страницы
const CD = (lang) => `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/${lang}/v1`;
const CD_GAME = 'https://raw.communitydragon.org/latest/game/data/characters';
const VIDEO_CDN = 'https://d28xe8vt774jo5.cloudfront.net/champion-abilities/';
const MERAKI = 'https://cdn.merakianalytics.com/riot/lol/resources/latest/en-US/champions.json';

async function getJson(url, { optional = false, retries = 3 } = {}) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return await res.json();
    } catch (err) {
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 600 * attempt));
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

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

// Тексты Data Dragon содержат разметку клиента (<br>, <magicDamage> и т. п.) и
// плейсхолдеры {{ ... }}, которые без игровых файлов не вычислить, — оставляем чистый текст.
function cleanText(html = '') {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// подписи, которых нет в Data Dragon
const TEXTS = {
  ru: { noCost: 'Без затрат', resource: 'Ресурс', none: 'Нет' },
  en: { noCost: 'No cost', resource: 'Resource', none: 'None' },
};

function costText(spell, partype, texts) {
  const costs = spell.cost ?? [];
  const free = costs.every((c) => c === 0);
  const raw = (spell.resource ?? '')
    .replace(/\{\{\s*abilityresourcename\s*\}\}/gi, partype)
    .replace(/\{\{\s*cost\s*\}\}/gi, spell.costBurn);
  if (raw && !/\{\{|@/.test(raw)) return cleanText(raw);
  if (free) return texts.noCost;
  return `${partype}: ${spell.costBurn}`;
}

/** Ресурс чемпиона ключом из английского названия: mana, energy, fury, blood-well, none… — для логики и цвета полоски. */
const resourceKey = (partype) => (partype ? partype.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '') : 'none');

const isLore = (tip, c) => {
  const head = tip.slice(0, 50);
  return cleanText(c.lore).includes(head) || cleanText(c.blurb).includes(head);
};

const round3 = (n) => Math.round(n * 1000) / 1000;

/** Характеристики из игровых файлов: запись Characters/<Name>/CharacterRecords/Root. */
function gameStats(bin) {
  if (!bin) return null;
  const key = Object.keys(bin).find((k) => /\/CharacterRecords\/Root$/i.test(k));
  const root = key && bin[key];
  if (!root) return null;
  const val = (field) => (typeof root[field]?.baseValue === 'number' ? round3(root[field].baseValue) : undefined);
  return {
    attackdamage: val('baseDamageModifiable'),
    attackdamageperlevel: val('damagePerLevelModifiable'),
    attackspeed: val('attackSpeedModifiable'),
    attackspeedratio: val('attackSpeedRatioModifiable'),
    attackspeedperlevel: val('attackSpeedPerLevelModifiable'),
    hp: val('baseHPModifiable'),
    hpperlevel: val('hpPerLevelModifiable'),
    armor: val('baseArmorModifiable'),
    armorperlevel: val('armorPerLevelModifiable'),
  };
}

const videoPath = (path) => (path ? path.replace(/^champion-abilities\//, '').replace(/\.webm$/, '') : null);

async function main() {
  const versions = await getJson(`${DD}/api/versions.json`);
  const version = versions[0];
  console.log(`Data Dragon: патч ${version}`);

  const fulls = await Promise.all(LOCALES.map((loc) => getJson(`${DD}/cdn/${version}/data/${loc.dd}/championFull.json`)));
  const base = Object.values(fulls[0].data);
  const english = fulls[LOCALES.findIndex((l) => l.code === 'en')].data;
  console.log(`  чемпионов: ${base.length}, языки: ${LOCALES.map((l) => l.code).join(', ')}`);

  console.log('CommunityDragon: стиль игры и образы…');
  const cdByLocale = await Promise.all(LOCALES.map((loc) => mapLimit(base, 8, (c) => getJson(`${CD(loc.cd)}/champions/${c.key}.json`, { optional: true }))));
  const cdragon = cdByLocale[0];

  console.log('CommunityDragon: игровые характеристики…');
  const bins = await mapLimit(base, 8, (c) => {
    const name = c.id.toLowerCase();
    return getJson(`${CD_GAME}/${name}/${name}.bin.json`, { optional: true });
  });
  const game = bins.map(gameStats);
  const mismatches = [];
  base.forEach((c, i) => {
    const g = game[i];
    if (!g) return;
    for (const f of ['hp', 'hpperlevel', 'armor', 'armorperlevel', 'attackdamage', 'attackspeed', 'attackspeedperlevel']) {
      if (g[f] !== undefined && Math.abs(g[f] - c.stats[f]) > 0.01) mismatches.push(`${c.id}.${f}: DD ${c.stats[f]} / игра ${g[f]}`);
    }
  });
  console.log(`  игровые данные: ${game.filter(Boolean).length} из ${base.length}; расхождений с Data Dragon (кроме прироста силы атаки): ${mismatches.length}`);
  mismatches.slice(0, 12).forEach((m) => console.log('   ', m));

  console.log('Meraki Analytics: позиции…');
  const meraki = (await getJson(MERAKI, { optional: true })) ?? {};

  const extras = new Map(base.map((c, i) => [c.id, { cd: cdragon[i], game: game[i], tags: cdByLocale.map((list) => list[i]?.championTagInfo) }]));

  const build = (c, texts, li) => {
    const { cd, game: g, tags } = extras.get(c.id) ?? {};
    const tagInfo = tags?.[li];
    const mk = meraki[c.id];
    const cdSkins = new Map((cd?.skins ?? []).map((s) => [String(s.id), s]));
    const cdSpells = new Map((cd?.spells ?? []).map((s) => [s.spellKey?.toUpperCase(), s]));
    const keys = ['Q', 'W', 'E', 'R'];

    return {
      id: c.id,
      slug: c.id.toLowerCase(),
      key: Number(c.key),
      name: c.name,
      title: c.title,
      tags: c.tags,
      partype: c.partype || texts.none,
      resource: resourceKey(english[c.id]?.partype),
      info: c.info,
      stats: {
        ...c.stats,
        // прирост силы атаки и коэффициент скорости атаки — из игровых файлов
        attackdamageperlevel: g?.attackdamageperlevel ?? c.stats.attackdamageperlevel,
        attackspeedratio: g?.attackspeedratio ?? c.stats.attackspeed,
      },
      blurb: cleanText(c.blurb),
      lore: cleanText(c.lore),
      // у некоторых чемпионов в советах лежит текст истории — такие «советы» отбрасываем
      allytips: c.allytips.map(cleanText).filter((t) => t && !isLore(t, c)),
      enemytips: c.enemytips.map(cleanText).filter((t) => t && !isLore(t, c)),
      passive: {
        name: c.passive.name,
        description: cleanText(c.passive.description),
        image: c.passive.image.full,
        video: videoPath(cd?.passive?.abilityVideoPath),
      },
      spells: c.spells.map((s, idx) => ({
        key: keys[idx],
        id: s.id,
        name: s.name,
        description: cleanText(s.description),
        maxrank: s.maxrank,
        cooldown: s.cooldown,
        cost: s.cost,
        costText: costText(s, c.partype || texts.resource, texts),
        range: s.rangeBurn === 'self' ? null : s.range,
        image: s.image.full,
        video: videoPath(cdSpells.get(keys[idx])?.abilityVideoPath),
      })),
      skins: c.skins
        .filter((s) => s.parentSkin === undefined)
        .map((s) => {
          const extra = cdSkins.get(s.id);
          return {
            num: s.num,
            name: s.num === 0 ? c.name : s.name,
            rarity: extra?.rarity && extra.rarity !== 'kNoRarity' ? extra.rarity : null,
            legacy: Boolean(extra?.isLegacy),
            chromas: c.skins.filter((x) => x.parentSkin === s.num).length,
          };
        }),
      playstyle: cd?.playstyleInfo ?? null,
      tactical: cd?.tacticalInfo
        ? {
            style: cd.tacticalInfo.style,
            difficulty: cd.tacticalInfo.difficulty,
            damageType: cd.tacticalInfo.damageType,
            attackType: cd.tacticalInfo.attackType,
          }
        : null,
      tagline: tagInfo ? [tagInfo.championTagPrimary, tagInfo.championTagSecondary].filter(Boolean) : [],
      positions: mk?.positions ?? [],
      releaseDate: mk?.releaseDate ?? null,
    };
  };

  const byLocale = LOCALES.map((loc, i) => Object.values(fulls[i].data).map((c) => build(c, TEXTS[loc.code], i)));
  const champions = byLocale[0];

  // Видео есть не для всех умений (особенно у новых чемпионов) — оставляем только доступные.
  console.log('Проверка видео умений…');
  const clips = champions.flatMap((c) => [c.passive, ...c.spells]).filter((a) => a.video);
  const exists = async (url) => {
    try {
      return (await fetch(url, { method: 'HEAD' })).ok;
    } catch {
      return false;
    }
  };
  const available = await mapLimit(clips, 16, async (a) => (await exists(`${VIDEO_CDN}${a.video}.webm`)) && exists(`${VIDEO_CDN}${a.video}.jpg`));
  const missing = new Set(clips.filter((_, i) => !available[i]).map((a) => a.video));
  for (const list of byLocale) for (const a of list.flatMap((c) => [c.passive, ...c.spells])) if (missing.has(a.video)) a.video = null;
  console.log(`  доступно ${available.filter(Boolean).length} из ${clips.length}`);

  byLocale.forEach((list, i) => list.sort((a, b) => a.name.localeCompare(b.name, LOCALES[i].code)));

  const meta = {
    version,
    fetchedAt: new Date().toISOString(),
    count: champions.length,
    withPlaystyle: champions.filter((c) => c.playstyle).length,
    withPositions: champions.filter((c) => c.positions.length).length,
    withGameStats: game.filter(Boolean).length,
  };

  for (const [i, loc] of LOCALES.entries()) {
    await mkdir(dataDir(loc.code), { recursive: true });
    await writeFile(new URL('champions.json', dataDir(loc.code)), JSON.stringify(byLocale[i]));
  }
  await writeFile(new URL('meta.json', DATA), JSON.stringify(meta, null, 2) + '\n');
  console.log('Готово:', meta);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
