// Билд: чемпион, линия, руны, заклинания и предметы. Ссылка хранит весь билд; здесь же расчёт характеристик.
// Модуль без данных — его можно импортировать и в клиентские компоненты.
import { defineMessages, type Locale } from '@rift/engine/i18n/locale';
import type { Item, ItemStat } from './items';
import { POSITION_ORDER, POSITIONS, type Position } from './labels';
import type { RuneTree, RunesData, Shard, SummonerSpell } from './runes';
import { statsAtLevel, type BaseStats } from './stats';

export const START_SLOTS = 3;
export const BUILD_SLOTS = 6;

export interface Build {
  champion: string | null;
  lane: Position | null;
  primary: number | null;
  /** ключевая руна и по одной из трёх рядов основного дерева */
  runes: (number | null)[];
  secondary: number | null;
  /** две руны дополнительного дерева из разных рядов, в порядке выбора */
  secondaryRunes: (number | null)[];
  shards: (number | null)[];
  spells: (string | null)[];
  start: (string | null)[];
  items: (string | null)[];
  name: string;
}

export interface BuildChampion {
  id: string;
  slug: string;
  name: string;
  title: string;
  positions: Position[];
  damageType: string;
  partype: string;
  /** ресурс ключом: mana, energy… */
  resource: string;
  stats: BaseStats;
}

export const emptyBuild = (): Build => ({
  champion: null,
  lane: null,
  primary: null,
  runes: [null, null, null, null],
  secondary: null,
  secondaryRunes: [null, null],
  shards: [null, null, null],
  spells: [null, null],
  start: Array(START_SLOTS).fill(null),
  items: Array(BUILD_SLOTS).fill(null),
  name: '',
});

/** В каком ряду дерева руна: 0 — ключевые, −1 — не из этого дерева. */
export const runeRow = (tree: RuneTree, id: number) => tree.slots.findIndex((row) => row.some((r) => r.id === id));

/** Руна дополнительного дерева: из того же ряда заменяет прежнюю, третья вытесняет самую раннюю — как в клиенте. */
export function pickSecondary(current: (number | null)[], tree: RuneTree, id: number): (number | null)[] {
  const row = runeRow(tree, id);
  if (row < 1) return current;
  const picked = current.filter((x): x is number => x !== null);
  if (picked.includes(id)) return [picked.find((x) => x !== id) ?? null, null];
  const sameRow = picked.findIndex((x) => runeRow(tree, x) === row);
  if (sameRow >= 0) picked.splice(sameRow, 1);
  picked.push(id);
  const next = picked.slice(-2);
  return [next[0] ?? null, next[1] ?? null];
}

// ── Ссылка: /builds?c=ahri&lane=middle&r=8200.8214.8226.8210.8237&r2=8300.8345.8347&sh=5008.5008.5011&sp=4.14&it=… ──

const num = (s: string) => Number(s) || null;
const list = (s: string | null) => (s ?? '').split('.').filter((x) => x !== '');

export function buildToQuery(b: Build, spells: SummonerSpell[]): string {
  const q = new URLSearchParams();
  if (b.champion) q.set('c', b.champion);
  if (b.lane) q.set('lane', b.lane.toLowerCase());
  if (b.primary) q.set('r', [b.primary, ...b.runes.map((x) => x ?? 0)].join('.'));
  if (b.secondary) q.set('r2', [b.secondary, ...b.secondaryRunes.map((x) => x ?? 0)].join('.'));
  if (b.shards.some(Boolean)) q.set('sh', b.shards.map((x) => x ?? 0).join('.'));
  if (b.spells.some(Boolean)) q.set('sp', b.spells.map((id) => spells.find((s) => s.id === id)?.key ?? 0).join('.'));
  if (b.start.some(Boolean)) q.set('st', b.start.map((x) => x ?? 0).join('.'));
  if (b.items.some(Boolean)) q.set('it', b.items.map((x) => x ?? 0).join('.'));
  if (b.name.trim()) q.set('n', b.name.trim());
  return q.toString().replace(/%2E/gi, '.');
}

interface Catalog {
  champions: { slug: string }[];
  runes: RunesData;
  spells: SummonerSpell[];
  items: Map<string, Item>;
}

/** Билд из ссылки: всё неизвестное или несовместимое отбрасывается. */
export function buildFromQuery(q: Pick<URLSearchParams, 'get'>, cat: Catalog): Build {
  const b = emptyBuild();
  const slug = q.get('c');
  if (slug && cat.champions.some((c) => c.slug === slug)) b.champion = slug;
  const lane = POSITION_ORDER.find((p) => p.toLowerCase() === q.get('lane'));
  if (lane) b.lane = lane;

  const [primaryId, ...runes] = list(q.get('r')).map(num);
  const primary = cat.runes.trees.find((t) => t.id === primaryId);
  if (primary) {
    b.primary = primary.id;
    b.runes = b.runes.map((_, row) => {
      const id = runes[row];
      return id && primary.slots[row]?.some((r) => r.id === id) ? id : null;
    });
  }

  const [secondaryId, ...secondaryRunes] = list(q.get('r2')).map(num);
  const secondary = cat.runes.trees.find((t) => t.id === secondaryId && t.id !== b.primary);
  if (secondary) {
    b.secondary = secondary.id;
    for (const id of secondaryRunes) if (id) b.secondaryRunes = pickSecondary(b.secondaryRunes, secondary, id);
  }

  b.shards = b.shards.map((_, row) => {
    const id = num(list(q.get('sh'))[row] ?? '');
    return id && cat.runes.shards[row]?.perks.some((p) => p.id === id) ? id : null;
  });

  const spellIds = list(q.get('sp')).map((key) => cat.spells.find((s) => s.key === key)?.id ?? null);
  b.spells = [spellIds[0] ?? null, spellIds[1] !== spellIds[0] ? (spellIds[1] ?? null) : null];

  const items = (raw: string | null, size: number) => {
    const ids = list(raw);
    return Array.from({ length: size }, (_, i) => (ids[i] && cat.items.has(ids[i]) ? ids[i] : null));
  };
  b.start = items(q.get('st'), START_SLOTS);
  b.items = items(q.get('it'), BUILD_SLOTS);
  b.name = (q.get('n') ?? '').slice(0, 60);
  return b;
}

// ── Характеристики ──

export type TotalKey = 'hp' | 'ad' | 'ap' | 'armor' | 'mr' | 'as' | 'crit' | 'ms' | 'haste' | 'lethality' | 'armorPenPct' | 'magicPen' | 'magicPenPct' | 'lifesteal' | 'omnivamp' | 'mana' | 'tenacity';
export type Totals = Record<TotalKey, number>;

const zero = (): Totals => ({ hp: 0, ad: 0, ap: 0, armor: 0, mr: 0, as: 0, crit: 0, ms: 0, haste: 0, lethality: 0, armorPenPct: 0, magicPen: 0, magicPenPct: 0, lifesteal: 0, omnivamp: 0, mana: 0, tenacity: 0 });

/** Мягкий предел скорости передвижения: выше 415 идёт 80%, выше 490 — половина. */
export function softCapMs(raw: number) {
  if (raw > 490) return 415 + 75 * 0.8 + (raw - 490) * 0.5;
  if (raw > 415) return 415 + (raw - 415) * 0.8;
  return raw;
}

export const AS_CAP = 2.5;

export interface BuildStats {
  base: Totals;
  total: Totals;
  /** во что ушла адаптивная сила осколков */
  adaptive: 'ad' | 'ap' | null;
  asCapped: boolean;
}

/** Характеристики чемпиона на уровне с предметами билда и осколками. Пассивные эффекты предметов и рун не учитываются. */
export function computeStats(ch: BuildChampion, b: Build, level: number, items: Map<string, Item>, shards: Map<number, Shard>): BuildStats {
  const s = statsAtLevel(ch.stats, level);
  const base: Totals = { ...zero(), hp: s.hp, ad: s.attackdamage, armor: s.armor, mr: s.spellblock, as: s.attackspeed, ms: s.movespeed, mana: ch.resource === 'mana' ? s.mp : 0 };

  const bonus: Partial<Record<ItemStat | 'adaptive', number>> = {};
  const add = (k: ItemStat | 'adaptive', v: number) => (bonus[k] = (bonus[k] ?? 0) + v);
  let tenacityLeft = 1;
  for (const id of b.items) {
    const item = id ? items.get(id) : undefined;
    if (!item) continue;
    for (const [k, v] of Object.entries(item.stats) as [ItemStat, number][]) {
      if (k === 'tenacity') tenacityLeft *= 1 - v / 100;
      else add(k, v);
    }
  }
  for (const id of b.shards) {
    const effect = id ? shards.get(id)?.effect : null;
    if (!effect) continue;
    if ('min' in effect) add('hp', effect.min + ((effect.max - effect.min) * (level - 1)) / 17);
    else if (effect.key === 'tenacity') tenacityLeft *= 1 - effect.value / 100;
    else add(effect.key as ItemStat | 'adaptive', effect.value);
  }

  // адаптивная сила: в силу атаки (×0,6) или в силу умений — смотря чего от предметов больше
  let adaptive: BuildStats['adaptive'] = null;
  if (bonus.adaptive) {
    const ad = bonus.ad ?? 0;
    const ap = bonus.ap ?? 0;
    adaptive = ap > ad ? 'ap' : ad > ap ? 'ad' : ch.damageType === 'kMagic' ? 'ap' : 'ad';
    if (adaptive === 'ad') add('ad', bonus.adaptive * 0.6);
    else add('ap', bonus.adaptive);
  }

  const ratio = ch.stats.attackspeedratio ?? ch.stats.attackspeed;
  const rawAs = s.attackspeed + (ratio * (bonus.as ?? 0)) / 100;
  const total: Totals = {
    hp: base.hp + (bonus.hp ?? 0),
    ad: base.ad + (bonus.ad ?? 0),
    ap: bonus.ap ?? 0,
    armor: base.armor + (bonus.armor ?? 0),
    mr: base.mr + (bonus.mr ?? 0),
    as: Math.min(AS_CAP, rawAs),
    crit: Math.min(100, bonus.crit ?? 0),
    ms: softCapMs((base.ms + (bonus.ms ?? 0)) * (1 + (bonus.msPct ?? 0) / 100)),
    haste: bonus.haste ?? 0,
    lethality: bonus.lethality ?? 0,
    armorPenPct: bonus.armorPenPct ?? 0,
    magicPen: bonus.magicPen ?? 0,
    magicPenPct: bonus.magicPenPct ?? 0,
    lifesteal: bonus.lifesteal ?? 0,
    omnivamp: bonus.omnivamp ?? 0,
    mana: base.mana > 0 ? base.mana + (bonus.mana ?? 0) : 0,
    tenacity: (1 - tenacityLeft) * 100,
  };
  return { base, total, adaptive, asCapped: rawAs > AS_CAP };
}

export const buildCost = (ids: (string | null)[], items: Map<string, Item>) => ids.reduce((sum, id) => sum + (id ? (items.get(id)?.gold.total ?? 0) : 0), 0);

const WARNINGS = defineMessages({
  ru: {
    boots: 'Сапоги в билде могут быть только одни.',
    twice: (item: string) => `«${item}» дважды: каждый легендарный предмет собирается один раз.`,
    needSmite: (smite: string) => `В лесу не обойтись без заклинания «${smite}».`,
    smiteOnly: (smite: string) => `«${smite}» нужна только в лесу.`,
    rareLane: (name: string, lane: string, usual: string) => `${name} редко играет на линии «${lane}»: обычно — ${usual.toLowerCase()}.`,
  },
  en: {
    boots: 'A build can only have one pair of boots.',
    twice: (item: string) => `${item} twice: each legendary item is built only once.`,
    needSmite: (smite: string) => `The jungle needs ${smite}.`,
    smiteOnly: (smite: string) => `${smite} is only for the jungle.`,
    rareLane: (name: string, lane: string, usual: string) => `${name} rarely plays ${lane}: usually ${usual}.`,
  },
});

/** Что в билде нарушает правила игры или выглядит странно. */
export function buildWarnings(b: Build, ch: BuildChampion | undefined, items: Map<string, Item>, spells: SummonerSpell[], lang: Locale): string[] {
  const t = WARNINGS[lang];
  const warnings: string[] = [];
  const chosen = b.items.map((id) => (id ? items.get(id) : undefined)).filter((x): x is Item => x !== undefined);
  if (chosen.filter((i) => i.category === 'boots').length > 1) warnings.push(t.boots);
  const seen = new Set<string>();
  for (const i of chosen) {
    if (i.category !== 'legendary') continue;
    if (seen.has(i.id)) warnings.push(t.twice(i.name));
    seen.add(i.id);
  }
  const smite = spells.find((s) => s.id === 'SummonerSmite');
  const hasSmite = b.spells.includes('SummonerSmite');
  if (b.lane === 'JUNGLE' && !hasSmite && smite) warnings.push(t.needSmite(smite.name));
  if (hasSmite && b.lane && b.lane !== 'JUNGLE' && smite) warnings.push(t.smiteOnly(smite.name));
  if (ch && b.lane && ch.positions.length > 0 && !ch.positions.includes(b.lane)) {
    const positions = POSITIONS[lang];
    warnings.push(t.rareLane(ch.name, positions[b.lane].label, ch.positions.map((p) => positions[p].label).join(', ')));
  }
  return warnings;
}

// ── Сохранённые билды ──

export interface SavedBuild {
  id: string;
  name: string;
  champion: string | null;
  savedAt: number;
  query: string;
}

const SAVED_KEY = 'rc:builds';

export function loadSavedBuilds(): SavedBuild[] {
  try {
    const data = JSON.parse(localStorage.getItem(SAVED_KEY) ?? '[]');
    return Array.isArray(data) ? data.filter((x) => x && typeof x.query === 'string') : [];
  } catch {
    return [];
  }
}

export function storeSavedBuilds(list: SavedBuild[]) {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(list));
  } catch {
    // хранилище недоступно — билд останется в ссылке
  }
}
