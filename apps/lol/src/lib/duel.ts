// Дуэль на автоатаках: два чемпиона бьют друг друга без умений, предметов, рун и критов.
// Работает и на сервере, и в браузере.
import { statsAtLevel, type BaseStats } from './stats';

export interface DuelSide {
  /** здоровье на выбранном уровне */
  hp: number;
  ad: number;
  attackSpeed: number;
  armor: number;
  range: number;
  moveSpeed: number;
  /** восстановление здоровья в секунду */
  regen: number;
  /** урон одного удара по противнику — после его брони */
  perHit: number;
  dps: number;
  /** какую долю физического урона снимает своя броня */
  blocked: number;
  /** когда начинает бить: у кого дальность меньше, тот сначала подходит */
  start: number;
  hits: number;
  dealt: number;
  hpLeft: number;
}

export interface DuelHit {
  t: number;
  from: 0 | 1;
  damage: number;
  /** здоровье цели после удара */
  hp: number;
}

export interface DuelResult {
  sides: [DuelSide, DuelSide];
  hits: DuelHit[];
  /** 0 — синяя сторона, 1 — красная, null — ничья */
  winner: 0 | 1 | null;
  duration: number;
}

const MAX_TIME = 180;

/** Броня снижает физический урон в 100 / (100 + броня) раз — как в игре. */
export const afterArmor = (damage: number, armor: number) => damage * (100 / (100 + armor));

export function simulateDuel(a: BaseStats, b: BaseStats, level: number, useRange = true): DuelResult {
  const s = [statsAtLevel(a, level), statsAtLevel(b, level)];
  const sides = s.map((x, i) => {
    const perHit = afterArmor(x.attackdamage, s[1 - i].armor);
    return {
      hp: x.hp,
      ad: x.attackdamage,
      attackSpeed: x.attackspeed,
      armor: x.armor,
      range: x.attackrange,
      moveSpeed: x.movespeed,
      regen: x.hpregen / 5,
      perHit,
      dps: perHit * x.attackspeed,
      blocked: x.armor / (100 + x.armor),
      start: 0,
      hits: 0,
      dealt: 0,
      hpLeft: x.hp,
    };
  }) as [DuelSide, DuelSide];

  // бой начинается на дистанции удара дальнего; ближний сначала подходит
  if (useRange && sides[0].range !== sides[1].range) {
    const shorter = sides[0].range < sides[1].range ? 0 : 1;
    sides[shorter].start = (sides[1 - shorter].range - sides[shorter].range) / sides[shorter].moveSpeed;
  }

  const hp = [sides[0].hp, sides[1].hp];
  const next = [sides[0].start, sides[1].start];
  const hits: DuelHit[] = [];
  let t = 0;
  let winner: 0 | 1 | null = null;

  while (t < MAX_TIME) {
    const at = Math.min(next[0], next[1]);
    for (const i of [0, 1]) hp[i] = Math.min(sides[i].hp, hp[i] + sides[i].regen * (at - t));
    t = at;
    for (const i of [0, 1] as const) {
      if (Math.abs(next[i] - at) > 1e-9) continue;
      const target = 1 - i;
      sides[i].dealt += Math.min(sides[i].perHit, Math.max(0, hp[target]));
      hp[target] -= sides[i].perHit;
      sides[i].hits += 1;
      hits.push({ t, from: i, damage: sides[i].perHit, hp: Math.max(0, hp[target]) });
      next[i] += 1 / sides[i].attackSpeed;
    }
    if (hp[0] <= 0 || hp[1] <= 0) {
      winner = hp[0] <= 0 && hp[1] <= 0 ? null : hp[1] <= 0 ? 0 : 1;
      break;
    }
  }

  sides[0].hpLeft = Math.max(0, hp[0]);
  sides[1].hpLeft = Math.max(0, hp[1]);
  return { sides, hits, winner, duration: t };
}

export interface Matchup {
  id: string;
  /** true — выиграл синий, false — проиграл, null — ничья */
  win: boolean | null;
  duration: number;
}

/** Дуэли чемпиона со всеми остальными: против кого он выигрывает размен автоатаками. */
export function matchups(stats: BaseStats, rivals: { id: string; stats: BaseStats }[], level: number, useRange = true): Matchup[] {
  return rivals.map((r) => {
    const d = simulateDuel(stats, r.stats, level, useRange);
    return { id: r.id, win: d.winner === null ? null : d.winner === 0, duration: d.duration };
  });
}
