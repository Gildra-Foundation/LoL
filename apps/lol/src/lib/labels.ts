// Справочники и подписи на языках сайта. Без данных о чемпионах — можно импортировать в клиентские компоненты.
import { defineMessages } from '@rift/engine/i18n/locale';

export type ClassTag = 'Fighter' | 'Tank' | 'Mage' | 'Assassin' | 'Support' | 'Marksman';
export type Position = 'TOP' | 'JUNGLE' | 'MIDDLE' | 'BOTTOM' | 'SUPPORT';

type ClassInfo = { label: string; plural: string; among: string; description: string };

export const CLASSES = defineMessages<Record<ClassTag, ClassInfo>>({
  ru: {
    Fighter: { label: 'Боец', plural: 'Бойцы', among: 'у бойцов', description: 'Дерутся в ближнем бою: много урона и достаточно здоровья, чтобы пережить ответ.' },
    Tank: { label: 'Танк', plural: 'Танки', among: 'у танков', description: 'Принимают урон на себя, начинают драки и держат врагов на месте.' },
    Mage: { label: 'Маг', plural: 'Маги', among: 'у магов', description: 'Бьют умениями издалека и контролируют пространство.' },
    Assassin: { label: 'Убийца', plural: 'Убийцы', among: 'у убийц', description: 'Быстро убивают одну цель и уходят до ответного удара.' },
    Support: { label: 'Поддержка', plural: 'Поддержка', among: 'у поддержки', description: 'Лечат, ставят щиты и останавливают врагов за союзников.' },
    Marksman: { label: 'Стрелок', plural: 'Стрелки', among: 'у стрелков', description: 'Наносят постоянный урон автоатаками с дистанции.' },
  },
  en: {
    Fighter: { label: 'Fighter', plural: 'Fighters', among: 'among fighters', description: 'Brawl up close: lots of damage and enough health to survive the answer.' },
    Tank: { label: 'Tank', plural: 'Tanks', among: 'among tanks', description: 'Soak up damage, start fights and keep enemies in place.' },
    Mage: { label: 'Mage', plural: 'Mages', among: 'among mages', description: 'Hit with abilities from afar and control space.' },
    Assassin: { label: 'Assassin', plural: 'Assassins', among: 'among assassins', description: 'Kill one target fast and get out before the counterattack.' },
    Support: { label: 'Support', plural: 'Supports', among: 'among supports', description: 'Heal, shield and stop enemies for their allies.' },
    Marksman: { label: 'Marksman', plural: 'Marksmen', among: 'among marksmen', description: 'Deal steady damage with basic attacks from range.' },
  },
});
export const CLASS_ORDER = Object.keys(CLASSES.ru) as ClassTag[];

export const POSITIONS = defineMessages<Record<Position, { label: string; short: string }>>({
  ru: {
    TOP: { label: 'Верхняя линия', short: 'Топ' },
    JUNGLE: { label: 'Лес', short: 'Лес' },
    MIDDLE: { label: 'Средняя линия', short: 'Мид' },
    BOTTOM: { label: 'Нижняя линия', short: 'Бот' },
    SUPPORT: { label: 'Поддержка', short: 'Саппорт' },
  },
  en: {
    TOP: { label: 'Top lane', short: 'Top' },
    JUNGLE: { label: 'Jungle', short: 'Jungle' },
    MIDDLE: { label: 'Middle lane', short: 'Mid' },
    BOTTOM: { label: 'Bottom lane', short: 'Bot' },
    SUPPORT: { label: 'Support', short: 'Support' },
  },
});
export const POSITION_ORDER = Object.keys(POSITIONS.ru) as Position[];

export const DAMAGE_TYPES = defineMessages<Record<string, string>>({
  ru: { kPhysical: 'Физический', kMagic: 'Магический', kMixed: 'Смешанный' },
  en: { kPhysical: 'Physical', kMagic: 'Magic', kMixed: 'Mixed' },
});
export const ATTACK_TYPES = defineMessages<Record<string, string>>({
  ru: { melee: 'Ближний бой', ranged: 'Дальний бой' },
  en: { melee: 'Melee', ranged: 'Ranged' },
});
export const DIFFICULTY = defineMessages<Record<number, string>>({
  ru: { 1: 'Низкая', 2: 'Средняя', 3: 'Высокая' },
  en: { 1: 'Low', 2: 'Moderate', 3: 'High' },
});

export type PlaystyleAxis = 'damage' | 'durability' | 'crowdControl' | 'mobility' | 'utility';
export const PLAYSTYLE_AXES = defineMessages<[PlaystyleAxis, string][]>({
  ru: [
    ['damage', 'Урон'],
    ['durability', 'Живучесть'],
    ['crowdControl', 'Контроль'],
    ['mobility', 'Мобильность'],
    ['utility', 'Полезность'],
  ],
  en: [
    ['damage', 'Damage'],
    ['durability', 'Toughness'],
    ['crowdControl', 'Control'],
    ['mobility', 'Mobility'],
    ['utility', 'Utility'],
  ],
});

/** Редкость образа: цвет общий, название — на языке страницы. */
const RARITY_COLORS: Record<string, string> = {
  kRare: '#3dbfb0',
  kEpic: '#3e9bff',
  kLegendary: '#e5484d',
  kMythic: '#b06cf0',
  kUltimate: '#e9883a',
  kExalted: '#e3b23c',
  kTranscendent: '#8fe6ff',
};
const rarities = (names: Record<string, string>) =>
  Object.fromEntries(Object.entries(names).map(([k, label]) => [k, { label, color: RARITY_COLORS[k] }])) as Record<string, { label: string; color: string }>;
export const RARITIES = defineMessages({
  ru: rarities({ kRare: 'Редкий', kEpic: 'Эпический', kLegendary: 'Легендарный', kMythic: 'Мифический', kUltimate: 'Ультимативный', kExalted: 'Возвышенный', kTranscendent: 'Трансцендентный' }),
  en: rarities({ kRare: 'Rare', kEpic: 'Epic', kLegendary: 'Legendary', kMythic: 'Mythic', kUltimate: 'Ultimate', kExalted: 'Exalted', kTranscendent: 'Transcendent' }),
});

/** Цвет полоски ресурса по ключу — как в игре: мана синяя, энергия жёлтая, ярость красная. */
export function resourceColor(resource: string): string {
  if (resource === 'mana') return 'var(--res-mana)';
  if (resource === 'energy') return 'var(--res-energy)';
  if (resource === 'flow' || resource === 'shield') return 'var(--res-other)';
  return 'var(--res-fury)';
}
