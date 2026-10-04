// Формулы характеристик. Модуль без данных — его можно импортировать и в клиентские скрипты.
import { LOCALES, defineMessages, type Locale } from '@rift/engine/i18n/locale';
import { fmt } from '@rift/engine/lib/format';

export { fmt };

export interface BaseStats {
  hp: number;
  hpperlevel: number;
  mp: number;
  mpperlevel: number;
  movespeed: number;
  armor: number;
  armorperlevel: number;
  spellblock: number;
  spellblockperlevel: number;
  attackrange: number;
  hpregen: number;
  hpregenperlevel: number;
  mpregen: number;
  mpregenperlevel: number;
  attackdamage: number;
  attackdamageperlevel: number;
  attackspeed: number;
  attackspeedperlevel: number;
  /** коэффициент скорости атаки: на него умножается бонусная скорость атаки */
  attackspeedratio?: number;
}

export const MAX_LEVEL = 18;
export const LEVELS = Array.from({ length: MAX_LEVEL }, (_, i) => i + 1);

/** Множитель роста на уровне n: (n − 1) × (0,7025 + 0,0175 × (n − 1)). На 18 уровне равен ровно 17. */
export const growthFactor = (level: number) => (level - 1) * (0.7025 + 0.0175 * (level - 1));

export type StatKey =
  | 'hp'
  | 'hpregen'
  | 'mp'
  | 'mpregen'
  | 'attackdamage'
  | 'attackspeed'
  | 'armor'
  | 'spellblock'
  | 'movespeed'
  | 'attackrange'
  | 'ehp_physical'
  | 'ehp_magic'
  | 'aa_dps';

export type StatValues = Record<StatKey, number>;

export function statsAtLevel(s: BaseStats, level: number): StatValues {
  const g = growthFactor(level);
  const hp = s.hp + s.hpperlevel * g;
  const armor = s.armor + s.armorperlevel * g;
  const spellblock = s.spellblock + s.spellblockperlevel * g;
  const attackdamage = s.attackdamage + s.attackdamageperlevel * g;
  // Прирост скорости атаки — бонус в процентах, который умножается на коэффициент скорости атаки.
  const attackspeed = s.attackspeed + (s.attackspeedratio ?? s.attackspeed) * (s.attackspeedperlevel / 100) * g;
  return {
    hp,
    hpregen: s.hpregen + s.hpregenperlevel * g,
    mp: s.mp + s.mpperlevel * g,
    mpregen: s.mpregen + s.mpregenperlevel * g,
    attackdamage,
    attackspeed,
    armor,
    spellblock,
    movespeed: s.movespeed,
    attackrange: s.attackrange,
    ehp_physical: hp * (1 + armor / 100),
    ehp_magic: hp * (1 + spellblock / 100),
    aa_dps: attackdamage * attackspeed,
  };
}

export interface StatDef {
  key: StatKey;
  label: string;
  short: string;
  decimals: number;
  icon: string;
  color: string;
  base?: keyof BaseStats;
  growth?: keyof BaseStats;
  /** прирост задан в процентах (скорость атаки) */
  percent?: boolean;
  hint?: string;
}

type StatMeta = Omit<StatDef, 'label' | 'short' | 'hint'>;

const STAT_META: Record<StatKey, StatMeta> = {
  hp: { key: 'hp', decimals: 0, icon: 'hp', color: 'var(--stat-hp)', base: 'hp', growth: 'hpperlevel' },
  hpregen: { key: 'hpregen', decimals: 1, icon: 'hpregen', color: 'var(--stat-hp)', base: 'hpregen', growth: 'hpregenperlevel' },
  mp: { key: 'mp', decimals: 0, icon: 'mp', color: 'var(--res-mana)', base: 'mp', growth: 'mpperlevel' },
  mpregen: { key: 'mpregen', decimals: 1, icon: 'mpregen', color: 'var(--res-mana)', base: 'mpregen', growth: 'mpregenperlevel' },
  attackdamage: { key: 'attackdamage', decimals: 0, icon: 'ad', color: 'var(--stat-ad)', base: 'attackdamage', growth: 'attackdamageperlevel' },
  attackspeed: { key: 'attackspeed', decimals: 3, icon: 'as', color: 'var(--stat-as)', base: 'attackspeed', growth: 'attackspeedperlevel', percent: true },
  armor: { key: 'armor', decimals: 0, icon: 'armor', color: 'var(--stat-armor)', base: 'armor', growth: 'armorperlevel' },
  spellblock: { key: 'spellblock', decimals: 0, icon: 'mr', color: 'var(--stat-mr)', base: 'spellblock', growth: 'spellblockperlevel' },
  movespeed: { key: 'movespeed', decimals: 0, icon: 'ms', color: 'var(--stat-ms)', base: 'movespeed' },
  attackrange: { key: 'attackrange', decimals: 0, icon: 'range', color: 'var(--stat-range)', base: 'attackrange' },
  ehp_physical: { key: 'ehp_physical', decimals: 0, icon: 'ehp', color: 'var(--stat-armor)' },
  ehp_magic: { key: 'ehp_magic', decimals: 0, icon: 'ehp', color: 'var(--stat-mr)' },
  aa_dps: { key: 'aa_dps', decimals: 1, icon: 'dps', color: 'var(--stat-dps)' },
};

type StatText = Pick<StatDef, 'label' | 'short' | 'hint'>;

const STAT_TEXT = defineMessages<Record<StatKey, StatText>>({
  ru: {
    hp: { label: 'Здоровье', short: 'Здоровье' },
    hpregen: { label: 'Восстановление здоровья', short: 'Восст. здоровья', hint: 'за 5 секунд' },
    mp: { label: 'Ресурс', short: 'Ресурс' },
    mpregen: { label: 'Восстановление ресурса', short: 'Восст. ресурса', hint: 'за 5 секунд' },
    attackdamage: { label: 'Сила атаки', short: 'Сила атаки' },
    attackspeed: { label: 'Скорость атаки', short: 'Скорость атаки', hint: 'атак в секунду' },
    armor: { label: 'Броня', short: 'Броня' },
    spellblock: { label: 'Сопротивление магии', short: 'Сопр. магии' },
    movespeed: { label: 'Скорость передвижения', short: 'Скорость' },
    attackrange: { label: 'Дальность атаки', short: 'Дальность' },
    ehp_physical: { label: 'Эффективное здоровье против физического урона', short: 'ЭЗ (физ.)', hint: 'Здоровье × (1 + Броня / 100)' },
    ehp_magic: { label: 'Эффективное здоровье против магического урона', short: 'ЭЗ (маг.)', hint: 'Здоровье × (1 + Сопр. магии / 100)' },
    aa_dps: { label: 'Урон автоатаками в секунду', short: 'Урон АА/с', hint: 'Сила атаки × Скорость атаки, без предметов' },
  },
  en: {
    hp: { label: 'Health', short: 'Health' },
    hpregen: { label: 'Health regen', short: 'Health regen', hint: 'per 5 seconds' },
    mp: { label: 'Resource', short: 'Resource' },
    mpregen: { label: 'Resource regen', short: 'Resource regen', hint: 'per 5 seconds' },
    attackdamage: { label: 'Attack damage', short: 'Attack damage' },
    attackspeed: { label: 'Attack speed', short: 'Attack speed', hint: 'attacks per second' },
    armor: { label: 'Armor', short: 'Armor' },
    spellblock: { label: 'Magic resist', short: 'Magic resist' },
    movespeed: { label: 'Move speed', short: 'Speed' },
    attackrange: { label: 'Attack range', short: 'Range' },
    ehp_physical: { label: 'Effective health against physical damage', short: 'EHP (phys.)', hint: 'Health × (1 + Armor / 100)' },
    ehp_magic: { label: 'Effective health against magic damage', short: 'EHP (magic)', hint: 'Health × (1 + Magic resist / 100)' },
    aa_dps: { label: 'Basic attack damage per second', short: 'AA DPS', hint: 'Attack damage × Attack speed, without items' },
  },
});

/** Характеристики с подписями на языке страницы: STATS[lang].armor.label. */
export const STATS = Object.fromEntries(
  LOCALES.map((l) => [l, Object.fromEntries((Object.keys(STAT_META) as StatKey[]).map((k) => [k, { ...STAT_META[k], ...STAT_TEXT[l][k] }]))]),
) as Record<Locale, Record<StatKey, StatDef>>;

/** Характеристики, по которым считаются места среди всех чемпионов. */
export const RANKED_STATS: StatKey[] = [
  'hp',
  'hpregen',
  'attackdamage',
  'attackspeed',
  'armor',
  'spellblock',
  'movespeed',
  'attackrange',
  'ehp_physical',
  'ehp_magic',
  'aa_dps',
];


export const fmtStat = (key: StatKey, value: number, lang: Locale) => fmt(value, STAT_META[key].decimals, lang);

/** Прирост за уровень в человекочитаемом виде: «+104», «+2,2%». */
export function fmtGrowth(def: StatDef, value: number, lang: Locale): string {
  if (!value) return '';
  const digits = Number.isInteger(value) ? 0 : value * 10 === Math.round(value * 10) ? 1 : 2;
  return `+${fmt(value, digits, lang)}${def.percent ? '%' : ''}`;
}
