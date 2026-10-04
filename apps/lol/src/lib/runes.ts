// Руны, осколки и заклинания призывателя: типы и цвета. Данные — src/data/runes.json и spells.json.

export interface Rune {
  id: number;
  key: string;
  name: string;
  icon: string;
  html: string;
}

export interface RuneTree {
  id: number;
  key: string;
  name: string;
  icon: string;
  /** нулевой ряд — ключевые руны, дальше три ряда обычных */
  slots: Rune[][];
}

export type ShardEffect = { key: string; value: number } | { key: 'hpScaling'; min: number; max: number };

export interface Shard {
  id: number;
  name: string;
  icon: string;
  html: string;
  effect: ShardEffect | null;
}

export interface RunesData {
  trees: RuneTree[];
  shards: { label: string; perks: Shard[] }[];
}

export interface SummonerSpell {
  id: string;
  /** числовой ключ Riot — короче для ссылки */
  key: string;
  name: string;
  description: string;
  cooldown: number;
  image: string;
}

/** Цвета деревьев — как в клиенте. */
export const TREE_COLORS: Record<string, string> = {
  Precision: '#c8aa6e',
  Domination: '#d44242',
  Sorcery: '#9faafc',
  Resolve: '#a1d586',
  Inspiration: '#49aab9',
};
