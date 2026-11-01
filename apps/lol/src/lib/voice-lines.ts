// Реплики озвучки из файлов игры: имя события Wwise → группа и уточнение («Убийство: Jinx, образ 4»).
import { defineMessages, type Locale } from '@rift/engine/i18n/locale';

export const VOICE_GROUPS = ['first', 'move', 'attack', 'kill', 'spells', 'taunt', 'joke', 'laugh', 'idle', 'recall', 'respawn', 'death', 'items', 'other'] as const;
export type VoiceGroup = (typeof VOICE_GROUPS)[number];

export const VOICE_LABELS = defineMessages({
  ru: {
    first: 'Начало игры и встречи',
    move: 'Передвижение',
    attack: 'Атака',
    kill: 'Убийства',
    spells: 'Умения',
    taunt: 'Насмешки',
    joke: 'Шутки',
    laugh: 'Смех',
    idle: 'Ожидание',
    recall: 'Возвращение',
    respawn: 'Возрождение',
    death: 'Гибель',
    items: 'Предметы',
    other: 'Другое',
    skin: (n: number) => `образ ${n}`,
    tauntResponse: 'ответ на насмешку',
    ally: 'союзник',
    enemy: 'противник',
    multi: { Double: 'двойное', Triple: 'тройное', Quadra: 'четверное', Penta: 'пентакилл', First: 'первое' } as Record<string, string>,
  },
  en: {
    first: 'Game start and encounters',
    move: 'Movement',
    attack: 'Attack',
    kill: 'Kills',
    spells: 'Abilities',
    taunt: 'Taunts',
    joke: 'Jokes',
    laugh: 'Laugh',
    idle: 'Idle',
    recall: 'Recall',
    respawn: 'Respawn',
    death: 'Death',
    items: 'Items',
    other: 'Other',
    skin: (n: number) => `skin ${n}`,
    tauntResponse: 'taunt response',
    ally: 'ally',
    enemy: 'enemy',
    multi: { Double: 'double', Triple: 'triple', Quadra: 'quadra', Penta: 'penta', First: 'first' } as Record<string, string>,
  },
});

/** «JinxSkin04» → «Jinx, образ 4»; «MoveFirstAllyStarGuardian» → «союзник: Star Guardian». */
function target(raw: string, lang: Locale): string {
  const t = VOICE_LABELS[lang];
  if (!raw || raw === 'General' || raw === 'Standard') return '';
  if (t.multi[raw]) return t.multi[raw];
  const side = /^(Ally|Enemy)(.+)$/.exec(raw);
  if (side) return `${side[1] === 'Ally' ? t.ally : t.enemy}: ${target(side[2], lang)}`;
  const skin = /^(.+?)Skin0*(\d+)$/.exec(raw);
  const words = (s: string) => s.replace(/([a-z])([A-Z])/g, '$1 $2');
  return skin ? `${words(skin[1])}, ${t.skin(Number(skin[2]))}` : words(raw);
}

/** Группа и уточнение реплики по имени события. */
export function voiceLine(event: string | undefined, lang: Locale): { group: VoiceGroup; detail: string } {
  if (!event) return { group: 'other', detail: '' };
  const e = event.replace(/(2D|3D)/, '');
  const spell = /(Q|W|E|R|Passive|BasicAttack\d*)_cast/.exec(event)?.[1];
  if (spell) return { group: spell.startsWith('Basic') ? 'attack' : 'spells', detail: spell.startsWith('Basic') ? '' : spell.replace('Passive', 'P') };
  const rules: [RegExp, VoiceGroup][] = [
    [/^MoveFirst(.*)$/, 'first'],
    [/^Move(.*)$/, 'move'],
    [/^Attack(.*)$/, 'attack'],
    [/^Kill(.*)$/, 'kill'],
    [/^TauntResponse(.*)$/, 'taunt'],
    [/^Taunt(.*)$/, 'taunt'],
    [/^Joke(.*)$/, 'joke'],
    [/^Laugh(.*)$/, 'laugh'],
    [/^Idle(.*)$/, 'idle'],
    [/^Recall(.*)$/, 'recall'],
    [/^Respawn(.*)$/, 'respawn'],
    [/^Death(.*)$/, 'death'],
    [/^(?:UseItem|Buy|Shop)(.*)$/, 'items'],
    [/^(?:GameStart|Start)(.*)$/, 'first'],
  ];
  for (const [re, group] of rules) {
    const m = re.exec(e);
    if (!m) continue;
    const detail = /^TauntResponse/.test(e) ? VOICE_LABELS[lang].tauntResponse : target(m[1], lang);
    return { group, detail };
  }
  return { group: 'other', detail: target(e, lang) };
}
