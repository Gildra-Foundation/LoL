// Предметы, руны и заклинания призывателя для библиотеки предметов и конструктора билдов — на всех языках сайта.
// Числа (характеристики, эффекты осколков) разбираются из русских описаний, остальные языки дают только названия и тексты.
// Версия берётся из src/data/meta.json, поэтому скрипт запускается после fetch-data.mjs: npm run update-data.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { DATA, LOCALES, dataDir } from './locales.mjs';

const meta = JSON.parse(await readFile(new URL('meta.json', DATA), 'utf8'));
const DD = (loc) => `https://ddragon.leagueoflegends.com/cdn/${meta.version}/data/${loc.dd}`;
const CD = (loc) => `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/${loc.cd}/v1`;
const [BASE, ...OTHERS] = LOCALES;
const CD_ASSETS = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/';

async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

// ── Описания Riot → безопасный HTML: только известные теги, без атрибутов ──
const TAG_CLASS = {
  passive: 'passive',
  active: 'active',
  physicalDamage: 'phys',
  magicDamage: 'magic',
  trueDamage: 'true',
  healing: 'heal',
  health: 'heal',
  scaleHealth: 'heal',
  shield: 'shield',
  scaleAP: 'ap',
  scaleAD: 'ad',
  scaleArmor: 'armor',
  scaleMR: 'mr',
  scaleMana: 'mana',
  attention: 'em',
  b: 'em',
  keyword: 'key',
  Keyword: 'key',
  keywordMajor: 'key',
  keywordStealth: 'key',
  status: 'key',
  speed: 'speed',
  attackSpeed: 'speed',
  gold: 'gold',
  rarityLegendary: 'key',
  spellName: 'key',
  OnHit: 'key',
  lifeSteal: 'heal',
  omnivamp: 'heal',
  rules: 'rules',
};

function toHtml(src = '') {
  return src
    .replace(/<stats>[\s\S]*?<\/stats>/g, '') // характеристики показываем отдельно
    .replace(/<li>/gi, '<br>')
    .replace(/<(\/?)([a-zA-Z-]+)[^>]*>/g, (_, close, tag) => {
      if (tag.toLowerCase() === 'br') return close ? '' : '<br>';
      const cls = TAG_CLASS[tag];
      if (!cls) return '';
      return close ? '</span>' : `<span class="${cls}">`;
    })
    .replace(/(\s*<br>\s*){3,}/g, '<br><br>')
    .replace(/^(\s*<br>)+|(<br>\s*)+$/g, '')
    .trim();
}

// ── Характеристики из блока <stats>: «45 силы атаки», «20% скорости атаки» ──
const STAT_KEYS = {
  здоровья: 'hp',
  'силы атаки': 'ad',
  'ускорения умений': 'haste',
  'силы умений': 'ap',
  '%скорости атаки': 'as',
  брони: 'armor',
  'сопротивления магии': 'mr',
  '%скорости передвижения': 'msPct',
  'скорости передвижения': 'ms',
  '%базового восстановления маны': 'manaRegen',
  '%базового восстановления здоровья': 'hpRegen',
  '%шанса критического удара': 'crit',
  '%критического урона': 'critDamage',
  маны: 'mana',
  смертоносности: 'lethality',
  '%пробивания брони': 'armorPenPct',
  'магического пробивания': 'magicPen',
  '%магического пробивания': 'magicPenPct',
  '%вампиризма': 'lifesteal',
  '%всестороннего вытягивания жизни': 'omnivamp',
  '%эффективности лечения и щитов': 'healShield',
  '%стойкости': 'tenacity',
  'золота каждые 10 сек.': 'goldPer10',
};

function parseStats(description, name) {
  const block = description.match(/<stats>([\s\S]*?)<\/stats>/);
  const stats = {};
  if (!block) return stats;
  for (const line of block[1].split(/<br\s*\/?>/i)) {
    const text = line.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const m = text.match(/^([\d.,]+)(%?)\s+(.+)$/);
    const key = m && STAT_KEYS[(m[2] ? '%' : '') + m[3]];
    if (!key) {
      console.warn(`  не разобрал характеристику «${text}» у «${name}»`);
      continue;
    }
    stats[key] = (stats[key] ?? 0) + Number(m[1].replace(',', '.'));
  }
  return stats;
}

// ── Предметы ──
// как в магазине: стартовые, расходуемые, сапоги, базовые, эпические, легендарные
const CATEGORY_OVERRIDES = { 1036: 'basic' }; // Длинный меч помечен как стартовый, но в магазине он базовый

function category(id, item, inShop) {
  if (CATEGORY_OVERRIDES[id]) return CATEGORY_OVERRIDES[id];
  const t = item.tags;
  if (t.includes('Consumable') || t.includes('Trinket')) return 'consumable';
  if (t.includes('Lane') || t.includes('Jungle')) return 'starter';
  if (t.includes('Boots')) return 'boots';
  const into = (item.into ?? []).filter(inShop);
  if (!into.length && item.gold.total >= 2000) return 'legendary';
  if (!item.from?.length) return 'basic';
  return 'epic';
}

async function fetchItems() {
  const { data } = await get(`${DD(BASE)}/item.json`);
  const seen = new Set();
  const kept = Object.entries(data).filter(([id, x]) => {
    // шестизначные id — копии предметов для других режимов
    const ok = id.length <= 4 && x.maps['11'] && x.gold.purchasable && x.inStore !== false && !x.hideFromAll && !x.requiredChampion && !x.requiredAlly;
    if (!ok || seen.has(x.name)) return false;
    seen.add(x.name);
    return true;
  });
  const ids = new Set(kept.map(([id]) => id));
  const inShop = (id) => ids.has(id);
  return kept.map(([id, x]) => ({
    id,
    name: x.name,
    plaintext: x.plaintext ?? '',
    category: category(id, x, inShop),
    gold: { total: x.gold.total, base: x.gold.base, sell: x.gold.sell },
    stats: parseStats(x.description, x.name),
    tags: x.tags,
    from: (x.from ?? []).filter(inShop),
    into: (x.into ?? []).filter(inShop),
    html: toHtml(x.description),
  }));
}

// ── Руны и осколки ──
const cdAsset = (path) => CD_ASSETS + path.replace('/lol-game-data/assets/', '').toLowerCase();

// «+9 адаптивной силы», «+10-180 здоровья (в зависимости от уровня)»
function shardEffect(desc) {
  const text = desc.replace(/<[^>]+>/g, '');
  const range = text.match(/\+(\d+)\s*[-–]\s*(\d+)\s+здоровья/);
  if (range) return { key: 'hpScaling', min: Number(range[1]), max: Number(range[2]) };
  const m = text.match(/\+([\d.,]+)(%?)\s+(.+?)(?:\s*\(|$)/);
  if (!m) return null;
  const value = Number(m[1].replace(',', '.'));
  const phrase = m[3].trim();
  if (phrase.startsWith('адаптивной силы')) return { key: 'adaptive', value };
  if (phrase.startsWith('стойкости')) return { key: 'tenacity', value };
  const key = STAT_KEYS[(m[2] ? '%' : '') + phrase];
  return key ? { key, value } : null;
}

async function fetchRunes() {
  const [reforged, styles, perks] = await Promise.all([get(`${DD(BASE)}/runesReforged.json`), get(`${CD(BASE)}/perkstyles.json`), get(`${CD(BASE)}/perks.json`)]);
  const perkById = new Map(perks.map((p) => [p.id, p]));
  const order = ['Precision', 'Domination', 'Sorcery', 'Resolve', 'Inspiration'];
  const trees = reforged
    .sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
    .map((t) => ({
      id: t.id,
      key: t.key,
      name: t.name,
      icon: t.icon,
      slots: t.slots.map((s) => s.runes.map((r) => ({ id: r.id, key: r.key, name: r.name, icon: r.icon, html: toHtml(r.shortDesc) }))),
    }));
  // осколки одинаковы во всех деревьях — берём ряды у первого
  const shardSlots = styles.styles[0].slots.filter((s) => s.type === 'kStatMod');
  const shards = shardSlots.map((s) => ({
    label: s.slotLabel,
    perks: s.perks.map((id) => {
      const p = perkById.get(id);
      const effect = shardEffect(p.shortDesc);
      if (!effect) console.warn(`  не разобрал осколок «${p.name}»: ${p.shortDesc}`);
      return { id, name: p.name, icon: cdAsset(p.iconPath), html: toHtml(p.shortDesc), effect };
    }),
  }));
  return { trees, shards };
}

// ── Заклинания призывателя для Ущелья ──
async function fetchSpells() {
  const { data } = await get(`${DD(BASE)}/summoner.json`);
  return Object.values(data)
    .filter((s) => s.modes.includes('CLASSIC'))
    .map((s) => ({ id: s.id, key: s.key, name: s.name, description: s.description, cooldown: s.cooldown[0], image: s.image.full }))
    .sort((a, b) => a.name.localeCompare(b.name, BASE.code));
}

/** Те же предметы, руны и заклинания с названиями и описаниями на другом языке. */
async function translate(loc, items, runes, spells) {
  const [{ data: itemData }, reforged, perks, styles, { data: spellData }] = await Promise.all([
    get(`${DD(loc)}/item.json`),
    get(`${DD(loc)}/runesReforged.json`),
    get(`${CD(loc)}/perks.json`),
    get(`${CD(loc)}/perkstyles.json`),
    get(`${DD(loc)}/summoner.json`),
  ]);
  const runeById = new Map(reforged.flatMap((t) => [[t.id, t], ...t.slots.flatMap((s) => s.runes.map((r) => [r.id, r]))]));
  const perkById = new Map(perks.map((p) => [p.id, p]));
  const shardSlots = styles.styles[0].slots.filter((s) => s.type === 'kStatMod');
  const spellById = new Map(Object.values(spellData).map((x) => [x.id, x]));
  return {
    items: items.map((it) => {
      const x = itemData[it.id];
      return x ? { ...it, name: x.name, plaintext: x.plaintext ?? '', html: toHtml(x.description) } : it;
    }),
    runes: {
      trees: runes.trees.map((t) => ({
        ...t,
        name: runeById.get(t.id)?.name ?? t.name,
        slots: t.slots.map((slot) =>
          slot.map((r) => {
            const x = runeById.get(r.id);
            return x ? { ...r, name: x.name, html: toHtml(x.shortDesc) } : r;
          }),
        ),
      })),
      shards: runes.shards.map((row, i) => ({
        ...row,
        label: shardSlots[i]?.slotLabel ?? row.label,
        perks: row.perks.map((p) => {
          const x = perkById.get(p.id);
          return x ? { ...p, name: x.name, html: toHtml(x.shortDesc) } : p;
        }),
      })),
    },
    spells: spells
      .map((sp) => {
        const x = spellById.get(sp.id);
        return x ? { ...sp, name: x.name, description: x.description } : sp;
      })
      .sort((a, b) => a.name.localeCompare(b.name, loc.code)),
  };
}

const save = async (code, data) => {
  await mkdir(dataDir(code), { recursive: true });
  for (const [name, value] of Object.entries(data)) await writeFile(new URL(`${name}.json`, dataDir(code)), JSON.stringify(value));
};

const [items, runes, spells] = await Promise.all([fetchItems(), fetchRunes(), fetchSpells()]);
await save(BASE.code, { items, runes, spells });
for (const loc of OTHERS) await save(loc.code, await translate(loc, items, runes, spells));
const count = (c) => items.filter((i) => i.category === c).length;
console.log(
  `Предметы: ${items.length} (стартовые ${count('starter')}, расходуемые ${count('consumable')}, сапоги ${count('boots')}, базовые ${count('basic')}, эпические ${count('epic')}, легендарные ${count('legendary')}).`,
);
console.log(`Руны: ${runes.trees.length} деревьев, ${runes.shards.length} ряда осколков. Заклинания: ${spells.length}. Языки: ${LOCALES.map((l) => l.code).join(', ')}. Патч ${meta.version}.`);
