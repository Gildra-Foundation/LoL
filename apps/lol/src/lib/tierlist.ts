// Тир-лист LoL: свой тир-лист у каждой линии. Движок — @rift/engine/tierlist.
import { defineMessages, type Locale } from '@rift/engine/i18n/locale';
import type { TierGroup } from '@rift/engine/tierlist/model';
import { POSITIONS, POSITION_ORDER } from './labels';

/** ключ хранилища не меняем — у игроков уже есть сохранённые расстановки */
export const TIER_STORAGE_KEY = 'rc:tier-list';

const ALL = defineMessages({ ru: { label: 'Все', title: 'Все чемпионы' }, en: { label: 'All', title: 'All champions' } });

/** Группы тир-листа: все чемпионы и каждая линия — подписи на языке страницы. */
export const laneGroups = (lang: Locale): TierGroup[] => [
  { key: 'all', param: 'all', label: ALL[lang].label, title: ALL[lang].title, all: true },
  ...POSITION_ORDER.map((p) => ({ key: p, param: p.toLowerCase(), label: POSITIONS[lang][p].short, title: POSITIONS[lang][p].label })),
];

export const TIER_TEXTS = defineMessages({
  ru: {
    pick: 'Выберите чемпиона',
    allPlaced: 'Все чемпионы расставлены. Поделитесь ссылкой или выберите другую линию.',
    benchLabel: 'Нераспределённые чемпионы',
    groupLabel: 'Линия',
    nothingToShare: 'Сначала расставьте хотя бы одного чемпиона',
    searchPlaceholder: 'Имя чемпиона',
  },
  en: {
    pick: 'Pick a champion',
    allPlaced: 'Every champion is placed. Share the link or pick another lane.',
    benchLabel: 'Unranked champions',
    groupLabel: 'Lane',
    nothingToShare: 'Place at least one champion first',
    searchPlaceholder: 'Champion name',
  },
});
