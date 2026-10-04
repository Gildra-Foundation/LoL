// «Угадай чемпиона»: признаки LoL для сравнения. Движок — @rift/engine/guess.
import { ordered, sameSet, sameValue, type GuessColumn, type GuessItem, type Judgement } from '@rift/engine/guess/model';
import { defineMessages, type Locale } from '@rift/engine/i18n/locale';
import { ATTACK_TYPES, CLASSES, DAMAGE_TYPES, DIFFICULTY, POSITIONS, type ClassTag, type Position } from './labels';

export interface GuessChampion extends GuessItem {
  tags: ClassTag[];
  positions: Position[];
  attackType: string;
  /** название ресурса на языке страницы */
  resource: string;
  damageType: string;
  difficulty: number;
  /** год выхода; у самых новых чемпионов его может не быть в источнике */
  year: number | null;
}

// смешанный урон частично совпадает и с физическим, и с магическим
const damage = (g: GuessChampion, a: GuessChampion): Judgement =>
  g.damageType === a.damageType ? { verdict: 'match' } : g.damageType === 'kMixed' || a.damageType === 'kMixed' ? { verdict: 'partial' } : { verdict: 'miss' };

const COLUMN_LABELS = defineMessages({
  ru: { class: 'Класс', lane: 'Линия', range: 'Бой', resource: 'Ресурс', damage: 'Урон', difficulty: 'Сложность', year: 'Год' },
  en: { class: 'Class', lane: 'Lane', range: 'Range', resource: 'Resource', damage: 'Damage', difficulty: 'Difficulty', year: 'Year' },
});

/** Колонки сравнения на языке страницы. */
export function guessColumns(lang: Locale): GuessColumn<GuessChampion>[] {
  const t = COLUMN_LABELS[lang];
  return [
    { label: t.class, value: (c) => c.tags.map((tag) => CLASSES[lang][tag].label).join(', '), judge: sameSet((c) => c.tags) },
    { label: t.lane, value: (c) => c.positions.map((p) => POSITIONS[lang][p].short).join(', ') || '—', judge: sameSet((c) => c.positions) },
    { label: t.range, value: (c) => ATTACK_TYPES[lang][c.attackType] ?? '—', judge: sameValue((c) => c.attackType) },
    { label: t.resource, value: (c) => c.resource, judge: sameValue((c) => c.resource) },
    { label: t.damage, value: (c) => DAMAGE_TYPES[lang][c.damageType] ?? '—', judge: damage },
    { label: t.difficulty, value: (c) => DIFFICULTY[lang][c.difficulty] ?? '—', judge: ordered((c) => c.difficulty) },
    { label: t.year, value: (c) => (c.year ? String(c.year) : '—'), judge: ordered((c) => c.year) },
  ];
}

/** день загадки №1 */
export const GUESS_FIRST_DAY = '2026-10-04';
export const GUESS_STORAGE_KEY = 'rc:guess';

export const GUESS_TEXTS = defineMessages({
  ru: {
    itemLabel: 'Чемпион',
    placeholder: 'Введите имя чемпиона',
    classicHint: 'После каждой попытки видно, какие признаки совпали с загаданным чемпионом.',
    artAlt: 'Кусочек арта загаданного чемпиона',
    another: 'Другой чемпион',
    shareClassic: 'угадай чемпиона',
    shareArt: 'угадай по арту',
  },
  en: {
    itemLabel: 'Champion',
    placeholder: 'Type a champion name',
    classicHint: 'After each guess you can see which traits match the hidden champion.',
    artAlt: 'A piece of the hidden champion’s art',
    another: 'Another champion',
    shareClassic: 'guess the champion',
    shareArt: 'guess by art',
  },
});
