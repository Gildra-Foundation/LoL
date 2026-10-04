'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import Link from '@rift/engine/i18n/Link';
import { useLocale, useMessages, usePagePath } from '@rift/engine/i18n/LocaleProvider';
import { defineMessages, type Locale } from '@rift/engine/i18n/locale';
import { Button } from '@rift/engine/ui/Button';
import { EntityPicker } from '@rift/engine/ui/EntityPicker';
import { Icon } from '@/components/Icon';
import { LevelControl } from '@rift/engine/ui/LevelControl';
import { championHref, img } from '@/lib/assets';
import { matchups, simulateDuel, type DuelResult, type DuelSide } from '@/lib/duel';
import { plural } from '@rift/engine/lib/format';
import { fmt, type BaseStats } from '@/lib/stats';
import styles from './DuelArena.module.css';

export interface DuelChampion {
  id: string;
  slug: string;
  name: string;
  title: string;
  stats: BaseStats;
}

type Phase = 'ready' | 'fight' | 'done';
type SideIndex = 0 | 1;

interface Popup {
  key: number;
  side: SideIndex;
  value: number;
  x: number;
}

const SPEEDS = [1, 2, 4, 8] as const;
/** скорость показа подбирается так, чтобы бой занимал секунд восемь */
const autoSpeed = (duration: number) => SPEEDS.find((s) => duration / s <= 8) ?? 8;

const sec = (t: number, locale: Locale) => fmt(t, 1, locale);
const pct = (share: number) => Math.round(share * 100);

const MESSAGES = defineMessages({
  ru: {
    banner: { draw: 'Ничья', win: 'Победа', loss: 'Повержен' },
    blue: 'Синяя сторона',
    red: 'Красная сторона',
    health: (name: string) => `Здоровье: ${name}`,
    approaching: 'Подходит на расстояние удара',
    perSecond: (value: string) => `${value} удара в секунду`,
    search: 'Имя чемпиона',
    seconds: 'с',
    clockNote: (speed: number) => `игровое время, показ ×${speed}`,
    skip: 'Пропустить',
    rematch: 'Реванш',
    fight: 'В бой',
    speed: 'Скорость показа',
    useRange: 'Учитывать дальность атаки',
    swap: 'Поменять стороны',
    draw: 'Ничья.',
    drawText: (time: string) => `За ${time} с оба чемпиона падают одновременно.`,
    wins: (time: string, hits: number, against: number, hpLeft: string, share: number) =>
      `побеждает за ${time} с: ${hits} ${plural(hits, ['удар', 'удара', 'ударов'], 'ru')} против ${against}. Остаётся ${hpLeft} здоровья (${share}%).`,
    firstStrike: (first: string, late: string, hits: number) =>
      `${first} бьёт первым: пока ${late} подходит, успевает ударить ${hits} ${plural(hits, ['раз', 'раза', 'раз'], 'ru')}.`,
    fighting: 'Идёт бой…',
    soon: 'Бой начнётся через мгновение.',
    numbers: (level: number) => `Цифры боя на ${level} уровне`,
    stat: 'Показатель',
    rows: {
      hp: 'Здоровье',
      perHit: 'Урон за удар после брони',
      attackSpeed: 'Ударов в секунду',
      dps: 'Урон в секунду',
      blocked: 'Броня снимает',
      regen: 'Восстановление за 5 с',
      range: 'Дальность атаки',
      start: 'Начинает бить',
    },
    after: (time: string) => `через ${time} с`,
    now: 'сразу',
    vsAll: (name: string, level: number) => `${name} против всех на ${level} уровне`,
    beats: 'Побеждает',
    outOf: (total: number) => `из ${total} ${plural(total, ['чемпиона', 'чемпионов', 'чемпионов'], 'ru')}`,
    easiest: 'Легче всего',
    noWins: 'Побед нет',
    hardest: 'Тяжелее всего',
    noLosses: 'Поражений нет',
    pickHint: 'Нажмите на чемпиона, чтобы выставить его на красную сторону.',
    winIn: (time: string) => `победа за ${time} с`,
    lossIn: (time: string) => `поражение за ${time} с`,
    disclaimer:
      'Только автоатаки: без умений, предметов, рун, критов и пассивок. Урон удара — сила атаки × 100 / (100 + броня противника). Если дальность разная, ближний сначала подходит со своей скоростью передвижения. Это проверка базовых характеристик, а не прогноз настоящего боя.',
  },
  en: {
    banner: { draw: 'Draw', win: 'Victory', loss: 'Defeat' },
    blue: 'Blue side',
    red: 'Red side',
    health: (name: string) => `Health: ${name}`,
    approaching: 'Moving into attack range',
    perSecond: (value: string) => `${value} attacks per second`,
    search: 'Champion name',
    seconds: 's',
    clockNote: (speed: number) => `game time, playback ×${speed}`,
    skip: 'Skip',
    rematch: 'Rematch',
    fight: 'Fight',
    speed: 'Playback speed',
    useRange: 'Factor in attack range',
    swap: 'Swap sides',
    draw: 'Draw.',
    drawText: (time: string) => `In ${time} s both champions go down at the same time.`,
    wins: (time: string, hits: number, against: number, hpLeft: string, share: number) =>
      `wins in ${time} s: ${hits} ${plural(hits, ['hit', 'hits', 'hits'], 'en')} to ${against}. ${hpLeft} health left (${share}%).`,
    firstStrike: (first: string, late: string, hits: number) =>
      `${first} strikes first and lands ${hits} ${plural(hits, ['hit', 'hits', 'hits'], 'en')} while ${late} closes in.`,
    fighting: 'Fight in progress…',
    soon: 'The fight starts in a moment.',
    numbers: (level: number) => `Fight numbers at level ${level}`,
    stat: 'Stat',
    rows: {
      hp: 'Health',
      perHit: 'Damage per hit after armor',
      attackSpeed: 'Attacks per second',
      dps: 'Damage per second',
      blocked: 'Armor blocks',
      regen: 'Health regen per 5 s',
      range: 'Attack range',
      start: 'Starts attacking',
    },
    after: (time: string) => `after ${time} s`,
    now: 'right away',
    vsAll: (name: string, level: number) => `${name} vs everyone at level ${level}`,
    beats: 'Beats',
    outOf: (total: number) => `of ${total} ${plural(total, ['champion', 'champions', 'champions'], 'en')}`,
    easiest: 'Easiest',
    noWins: 'No wins',
    hardest: 'Hardest',
    noLosses: 'No losses',
    pickHint: 'Click a champion to put them on the red side.',
    winIn: (time: string) => `win in ${time} s`,
    lossIn: (time: string) => `loss in ${time} s`,
    disclaimer:
      'Basic attacks only: no abilities, items, runes, critical strikes or passives. Damage per hit is attack damage × 100 / (100 + enemy armor). If attack ranges differ, the shorter-ranged champion first closes in at their move speed. This is a check of base stats, not a prediction of a real fight.',
  },
});

/** Здоровье стороны к моменту t: значение после последнего полученного удара. */
function hpAt(result: DuelResult, side: SideIndex, t: number) {
  let hp = result.sides[side].hp;
  for (const h of result.hits) {
    if (h.t > t) break;
    if (h.from !== side) hp = h.hp;
  }
  return hp;
}

/** Доля пути до следующего удара — полоска замаха под здоровьем. */
function swingAt(side: DuelSide, t: number) {
  if (t < side.start) return 0;
  const p = (t - side.start) * side.attackSpeed;
  return p - Math.floor(p);
}

interface DuelArenaProps {
  champions: DuelChampion[];
  defaults: { a: string; b: string; level: number };
}

/** Дуэль на автоатаках: живой бой с полосками здоровья, всплывающим уроном и разбором цифр. */
export function DuelArena({ champions, defaults }: DuelArenaProps) {
  const t = useMessages(MESSAGES);
  const locale = useLocale();
  const pathname = usePagePath();
  const params = useSearchParams();
  const bySlug = useMemo(() => new Map(champions.map((c) => [c.slug, c])), [champions]);
  const byId = useMemo(() => new Map(champions.map((c) => [c.id, c])), [champions]);
  const a = bySlug.get(params.get('a') ?? '') ?? bySlug.get(defaults.a) ?? champions[0];
  const b = bySlug.get(params.get('b') ?? '') ?? bySlug.get(defaults.b) ?? champions[1];
  const level = Math.min(18, Math.max(1, Number(params.get('level')) || defaults.level));
  const fighters = [a, b] as const;

  const [useRange, setUseRange] = useState(true);
  const result = useMemo(() => simulateDuel(a.stats, b.stats, level, useRange), [a, b, level, useRange]);

  const [phase, setPhase] = useState<Phase>('ready');
  const [time, setTime] = useState(0);
  const [speed, setSpeed] = useState(() => autoSpeed(result.duration));
  const [popups, setPopups] = useState<Popup[]>([]);

  const runner = useRef<{ raf: number; origin: number; speed: number; index: number } | null>(null);
  const popupKey = useRef(0);
  const blueCard = useRef<HTMLDivElement>(null);
  const redCard = useRef<HTMLDivElement>(null);
  const bluePortrait = useRef<HTMLDivElement>(null);
  const redPortrait = useRef<HTMLDivElement>(null);
  const cards = [blueCard, redCard];
  const portraits = [bluePortrait, redPortrait];

  const setParams = (next: Record<string, string>) => {
    const q = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) q.set(k, v);
    window.history.replaceState(null, '', `${pathname}?${q}`);
  };

  const stop = () => {
    if (runner.current) cancelAnimationFrame(runner.current.raf);
    runner.current = null;
  };

  // удар: атакующий делает выпад, цель вздрагивает и вспыхивает
  const animateHit = (from: SideIndex) => {
    const dir = from === 0 ? 1 : -1;
    cards[from].current?.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${12 * dir}px)` }, { transform: 'translateX(0)' }], {
      duration: 170,
      easing: 'ease-out',
    });
    portraits[1 - from].current?.animate(
      [
        { transform: 'translateX(0)', filter: 'brightness(1.7) saturate(0.6)' },
        { transform: `translateX(${5 * dir}px)` },
        { transform: `translateX(${-3 * dir}px)` },
        { transform: 'translateX(0)', filter: 'none' },
      ],
      { duration: 240, easing: 'ease-out' },
    );
  };

  const startFight = () => {
    stop();
    setPopups([]);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setTime(result.duration);
      setPhase('done');
      return;
    }
    setTime(0);
    setPhase('fight');
    const r = { raf: 0, origin: performance.now(), speed, index: 0 };
    runner.current = r;
    // время берём из performance.now(): метка кадра requestAnimationFrame идёт по другим часам и бывает раньше старта
    const tick = () => {
      const t = Math.max(0, ((performance.now() - r.origin) / 1000) * r.speed);
      const fresh: Popup[] = [];
      while (r.index < result.hits.length && result.hits[r.index].t <= t) {
        const h = result.hits[r.index++];
        fresh.push({ key: popupKey.current++, side: (1 - h.from) as SideIndex, value: h.damage, x: 16 + Math.random() * 58 });
        animateHit(h.from);
      }
      if (fresh.length) setPopups((p) => [...p.slice(-10), ...fresh]);
      if (t >= result.duration) {
        runner.current = null;
        setTime(result.duration);
        setPhase('done');
        return;
      }
      setTime(t);
      r.raf = requestAnimationFrame(tick);
    };
    r.raf = requestAnimationFrame(tick);
  };

  const skip = () => {
    stop();
    setPopups([]);
    setTime(result.duration);
    setPhase('done');
  };

  const changeSpeed = (s: number) => {
    const r = runner.current;
    if (r) {
      const now = performance.now();
      const t = ((now - r.origin) / 1000) * r.speed;
      r.origin = now - (t / s) * 1000;
      r.speed = s;
    }
    setSpeed(s as (typeof SPEEDS)[number]);
  };

  // новый бой при смене чемпионов, уровня или правил — с небольшой паузой, чтобы уровень можно было пролистать
  const autoStart = useEffectEvent(() => startFight());
  const fightKey = `${a.id}:${b.id}:${level}:${useRange}`;
  const resetFight = useEffectEvent(() => {
    stop();
    setPhase('ready');
    setTime(0);
    setPopups([]);
    setSpeed(autoSpeed(result.duration));
  });
  useEffect(() => {
    resetFight();
    const timer = setTimeout(() => autoStart(), 650);
    return () => {
      clearTimeout(timer);
      if (runner.current) cancelAnimationFrame(runner.current.raf);
      runner.current = null;
    };
  }, [fightKey]);

  const rivals = useMemo(() => champions.filter((c) => c.id !== a.id), [champions, a]);
  const table = useMemo(() => matchups(a.stats, rivals, level, useRange), [a, rivals, level, useRange]);
  const wins = table.filter((m) => m.win === true);
  const losses = table.filter((m) => m.win === false);
  const easiest = [...wins].sort((x, y) => x.duration - y.duration).slice(0, 5);
  const hardest = [...losses].sort((x, y) => x.duration - y.duration).slice(0, 5);

  const done = phase === 'done';
  const { winner, sides } = result;
  const late = sides[0].start > 0 ? 0 : sides[1].start > 0 ? 1 : null;
  const freeHits = late === null ? 0 : result.hits.filter((h) => h.from !== late && h.t < sides[late].start).length;

  const rows: { label: string; values: [string | number, string | number]; unit?: string; better?: SideIndex | null }[] = [
    { label: t.rows.hp, values: [fmt(sides[0].hp, 0, locale), fmt(sides[1].hp, 0, locale)], better: best(sides[0].hp, sides[1].hp) },
    { label: t.rows.perHit, values: [num(sides[0].perHit, locale), num(sides[1].perHit, locale)], better: best(sides[0].perHit, sides[1].perHit) },
    {
      label: t.rows.attackSpeed,
      values: [dec(sides[0].attackSpeed, locale), dec(sides[1].attackSpeed, locale)],
      better: best(sides[0].attackSpeed, sides[1].attackSpeed),
    },
    { label: t.rows.dps, values: [num(sides[0].dps, locale), num(sides[1].dps, locale)], better: best(sides[0].dps, sides[1].dps) },
    { label: t.rows.blocked, values: [pct(sides[0].blocked), pct(sides[1].blocked)], unit: '%', better: best(sides[0].blocked, sides[1].blocked) },
    { label: t.rows.regen, values: [num(sides[0].regen * 5, locale), num(sides[1].regen * 5, locale)], better: best(sides[0].regen, sides[1].regen) },
    { label: t.rows.range, values: [fmt(sides[0].range, 0, locale), fmt(sides[1].range, 0, locale)], better: best(sides[0].range, sides[1].range) },
    {
      label: t.rows.start,
      values: [sides[0].start > 0 ? t.after(sec(sides[0].start, locale)) : t.now, sides[1].start > 0 ? t.after(sec(sides[1].start, locale)) : t.now],
    },
  ];

  return (
    <div className={styles.root}>
      <div className={styles.arena} data-phase={phase}>
        {fighters.map((c, i) => {
          const side = i as SideIndex;
          const s = sides[side];
          const hp = phase === 'ready' ? s.hp : done ? s.hpLeft : hpAt(result, side, time);
          const dead = done && winner !== null && winner !== side;
          const banner = done ? (winner === null ? t.banner.draw : winner === side ? t.banner.win : t.banner.loss) : null;
          return (
            <div
              key={side}
              ref={cards[side]}
              className={styles.fighter}
              data-side={side === 0 ? 'blue' : 'red'}
              data-dead={dead || undefined}
              style={{ '--side': side === 0 ? 'var(--ally)' : 'var(--enemy)' } as React.CSSProperties}
            >
              <div ref={portraits[side]} className={styles.portrait}>
                <img src={img.loading(c.id)} alt="" width={308} height={560} />
                {popups
                  .filter((p) => p.side === side)
                  .map((p) => (
                    <span
                      key={p.key}
                      className={styles.popup}
                      style={{ left: `${p.x}%` }}
                      onAnimationEnd={() => setPopups((all) => all.filter((x) => x.key !== p.key))}
                    >
                      {Math.round(p.value)}
                    </span>
                  ))}
                {banner && (
                  <span className={styles.banner} data-kind={winner === null ? 'draw' : winner === side ? 'win' : 'loss'}>
                    {banner}
                  </span>
                )}
              </div>

              <div className={styles.fighterInfo}>
                <p className={styles.sideName}>{side === 0 ? t.blue : t.red}</p>
                <h2>
                  <Link href={championHref(c.slug)}>{c.name}</Link>
                </h2>
                <p className={styles.title}>{c.title}</p>
                <CombatBar hp={hp} max={s.hp} reverse={side === 1} label={t.health(c.name)} />
                <div className={styles.swing} aria-hidden="true">
                  <span style={{ width: `${(phase === 'fight' ? swingAt(s, time) : 0) * 100}%` }} />
                </div>
                <p className={styles.swingNote}>{phase === 'fight' && time < s.start ? t.approaching : t.perSecond(dec(s.attackSpeed, locale))}</p>
                <EntityPicker
                  side={side === 0 ? 'blue' : 'red'}
                  current={c}
                  items={champions}
                  iconUrl={img.icon}
                  placeholder={t.search}
                  onPick={(next) => setParams({ [side === 0 ? 'a' : 'b']: next.slug })}
                />
              </div>
            </div>
          );
        })}

        <div className={styles.center}>
          <p className={styles.clock}>
            <span className="num">{sec(time, locale)}</span> {t.seconds}
          </p>
          <p className={styles.clockNote}>{t.clockNote(speed)}</p>
          {phase === 'fight' ? (
            <Button onClick={skip}>{t.skip}</Button>
          ) : (
            <Button variant="primary" onClick={startFight}>
              {done ? t.rematch : t.fight}
            </Button>
          )}
          <div className={styles.speeds} role="group" aria-label={t.speed}>
            {SPEEDS.map((s) => (
              <button key={s} type="button" aria-pressed={speed === s} onClick={() => changeSpeed(s)}>
                ×{s}
              </button>
            ))}
          </div>
          <LevelControl value={level} onChange={(l) => setParams({ level: String(l) })} compact id="duel-level" />
          <label className={styles.toggle}>
            <input type="checkbox" checked={useRange} onChange={(e) => setUseRange(e.currentTarget.checked)} />
            {t.useRange}
          </label>
          <button type="button" className={styles.swap} onClick={() => setParams({ a: b.slug, b: a.slug })}>
            <Icon name="swap" size={16} />
            {t.swap}
          </button>
        </div>
      </div>

      <div className={styles.verdict} aria-live="polite">
        {done ? (
          winner === null ? (
            <p>
              <b>{t.draw}</b> {t.drawText(sec(result.duration, locale))}
            </p>
          ) : (
            <p>
              <b>{fighters[winner].name}</b>{' '}
              {t.wins(
                sec(result.duration, locale),
                sides[winner].hits,
                sides[1 - winner].hits,
                fmt(sides[winner].hpLeft, 0, locale),
                pct(sides[winner].hpLeft / sides[winner].hp),
              )}
              {late !== null && freeHits > 0 && ` ${t.firstStrike(fighters[1 - late].name, fighters[late].name, freeHits)}`}
            </p>
          )
        ) : (
          <p className={styles.waiting}>{phase === 'fight' ? t.fighting : t.soon}</p>
        )}
      </div>

      <div className={styles.details}>
        <section className={styles.numbers} aria-labelledby="duel-numbers">
          <h2 id="duel-numbers">{t.numbers(level)}</h2>
          <table>
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr-only">{t.stat}</span>
                </th>
                <th scope="col" data-side="blue">
                  {a.name}
                </th>
                <th scope="col" data-side="red">
                  {b.name}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label}>
                  <th scope="row">{r.label}</th>
                  {r.values.map((v, i) => (
                    <td key={i} className="num" data-better={r.better === i || undefined} data-side={i === 0 ? 'blue' : 'red'}>
                      {v}
                      {r.unit && <span className={styles.unit}>{r.unit}</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className={styles.matchups} aria-labelledby="duel-matchups">
          <h2 id="duel-matchups">{t.vsAll(a.name, level)}</h2>
          <p className={styles.score}>
            {t.beats} <b className="num">{wins.length}</b> {t.outOf(table.length)}
          </p>
          <div className={styles.scoreBar} aria-hidden="true">
            <span style={{ width: `${(wins.length / table.length) * 100}%` }} />
          </div>
          <div className={styles.lists}>
            <MatchList title={t.easiest} empty={t.noWins} items={easiest} byId={byId} onPick={(c) => setParams({ b: c.slug })} kind="win" />
            <MatchList title={t.hardest} empty={t.noLosses} items={hardest} byId={byId} onPick={(c) => setParams({ b: c.slug })} kind="loss" />
          </div>
          <p className={styles.listNote}>{t.pickHint}</p>
        </section>
      </div>

      <p className={styles.disclaimer}>{t.disclaimer}</p>
    </div>
  );
}

const num = (v: number, locale: Locale) => fmt(v, 1, locale);
const dec = (v: number, locale: Locale) => fmt(v, 2, locale);
const best = (x: number, y: number): SideIndex | null => (Math.abs(x - y) < 1e-6 ? null : x > y ? 0 : 1);

/** Полоска здоровья для боя: урон оставляет светлый след, который догоняет полоску с задержкой — как в игре. */
function CombatBar({ hp, max, reverse, label }: { hp: number; max: number; reverse: boolean; label: string }) {
  const locale = useLocale();
  const share = max > 0 ? Math.max(0, hp / max) : 0;
  return (
    <div
      className={styles.bar}
      data-reverse={reverse || undefined}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.round(max)}
      aria-valuenow={Math.round(hp)}
      style={{ '--hp': `${share * 100}%`, '--tick': `${(100 / max) * 100}%`, '--major': `${(1000 / max) * 100}%` } as React.CSSProperties}
    >
      <span className={styles.trail} />
      <span className={styles.fill} />
      <span className={styles.ticks} />
      <span className={styles.caption}>
        {fmt(hp, 0, locale)} / {fmt(max, 0, locale)}
      </span>
    </div>
  );
}

interface MatchListProps {
  title: string;
  empty: string;
  items: { id: string; duration: number }[];
  byId: Map<string, DuelChampion>;
  onPick: (c: DuelChampion) => void;
  kind: 'win' | 'loss';
}

function MatchList({ title, empty, items, byId, onPick, kind }: MatchListProps) {
  const t = useMessages(MESSAGES);
  const locale = useLocale();
  return (
    <div className={styles.list} data-kind={kind}>
      <h3>{title}</h3>
      {items.length === 0 ? (
        <p className={styles.none}>{empty}</p>
      ) : (
        <ol>
          {items.map((m) => {
            const c = byId.get(m.id);
            if (!c) return null;
            return (
              <li key={m.id}>
                <button type="button" onClick={() => onPick(c)}>
                  <img src={img.icon(c.id)} alt="" width={120} height={120} loading="lazy" />
                  <span>{c.name}</span>
                  <small>{kind === 'win' ? t.winIn(sec(m.duration, locale)) : t.lossIn(sec(m.duration, locale))}</small>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
