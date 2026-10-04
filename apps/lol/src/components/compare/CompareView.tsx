'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { ViewTransition } from 'react';
import Link from '@rift/engine/i18n/Link';
import { useLocale, useMessages, usePagePath } from '@rift/engine/i18n/LocaleProvider';
import { defineMessages } from '@rift/engine/i18n/locale';
import { EntityPicker } from '@rift/engine/ui/EntityPicker';
import { Icon } from '@/components/Icon';
import { LevelControl } from '@rift/engine/ui/LevelControl';
import { Radar } from '@rift/engine/ui/Radar';
import { ResourceBar } from '@rift/engine/ui/ResourceBar';
import { championHref, img } from '@/lib/assets';
import { ATTACK_TYPES, CLASSES, DAMAGE_TYPES, DIFFICULTY, PLAYSTYLE_AXES, POSITIONS, type ClassTag, type Position } from '@/lib/labels';
import { STATS, fmt, fmtStat, statsAtLevel, type BaseStats, type StatKey } from '@/lib/stats';
import styles from './CompareView.module.css';

export interface CompareChampion {
  id: string;
  slug: string;
  name: string;
  title: string;
  tags: ClassTag[];
  positions: Position[];
  partype: string;
  attackType: string;
  damageType: string;
  difficulty: number;
  info: { attack: number; defense: number; magic: number; difficulty: number };
  playstyle: { damage: number; durability: number; crowdControl: number; mobility: number; utility: number } | null;
  stats: BaseStats;
  /** самый похожий чемпион — соперник по умолчанию */
  rival: string;
}

const ROWS: StatKey[] = ['hp', 'hpregen', 'attackdamage', 'attackspeed', 'armor', 'spellblock', 'movespeed', 'attackrange', 'ehp_physical', 'ehp_magic', 'aa_dps'];

const MESSAGES = defineMessages({
  ru: {
    blue: 'Синяя сторона',
    red: 'Красная сторона',
    health: (name: string) => `Здоровье: ${name}`,
    change: 'Сменить чемпиона',
    search: 'Имя чемпиона',
    vs: 'против',
    ticks: 'Делений на полоске здоровья столько, сколько сотен здоровья у чемпиона на этом уровне.',
    more: (pct: string, name: string) => `+${pct}% у ${name}`,
    even: 'поровну',
    playstyle: 'Стиль игры',
    ratings: 'Оценки Riot от 1 до 3',
    profile: 'Профиль',
    param: 'Параметр',
    class: 'Класс',
    positions: 'Позиции',
    attack: 'Атака',
    damage: 'Урон',
    resource: 'Ресурс',
    difficulty: 'Сложность',
    noData: 'нет данных',
  },
  en: {
    blue: 'Blue side',
    red: 'Red side',
    health: (name: string) => `Health: ${name}`,
    change: 'Change champion',
    search: 'Champion name',
    vs: 'vs',
    ticks: 'The health bar has one tick for every 100 health the champion has at this level.',
    more: (pct: string, name: string) => `+${pct}% for ${name}`,
    even: 'equal',
    playstyle: 'Playstyle',
    ratings: 'Riot ratings from 1 to 3',
    profile: 'Profile',
    param: 'Attribute',
    class: 'Class',
    positions: 'Positions',
    attack: 'Attack type',
    damage: 'Damage',
    resource: 'Resource',
    difficulty: 'Difficulty',
    noData: 'no data',
  },
});

/** Два чемпиона на одной шкале: синяя сторона против красной на выбранном уровне. */
export function CompareView({ champions }: { champions: CompareChampion[] }) {
  const t = useMessages(MESSAGES);
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePagePath();
  const params = useSearchParams();
  const bySlug = new Map(champions.map((c) => [c.slug, c]));

  const a = bySlug.get(params.get('a') ?? '') ?? bySlug.get('garen')!;
  const bParam = bySlug.get(params.get('b') ?? '');
  const b = bParam && bParam.id !== a.id ? bParam : (bySlug.get(params.get('a') ? a.rival : 'darius') ?? champions[1]);
  const level = Math.min(18, Math.max(1, Number(params.get('level')) || 1));

  const go = (next: { a?: string; b?: string; level?: number }) => {
    const q = new URLSearchParams({ a: next.a ?? a.slug, b: next.b ?? b.slug });
    const lvl = next.level ?? level;
    if (lvl > 1) q.set('level', String(lvl));
    router.replace(`${pathname}?${q}`, { scroll: false });
  };

  const va = statsAtLevel(a.stats, level);
  const vb = statsAtLevel(b.stats, level);
  const all = champions.map((c) => statsAtLevel(c.stats, level));
  const maxOf = (key: StatKey) => Math.max(...all.map((v) => v[key]));

  const sides = [
    { side: 'blue' as const, c: a, v: va, label: t.blue, pick: (c: CompareChampion) => go(c.id === b.id ? { a: c.slug, b: a.slug } : { a: c.slug }) },
    { side: 'red' as const, c: b, v: vb, label: t.red, pick: (c: CompareChampion) => go(c.id === a.id ? { a: b.slug, b: c.slug } : { b: c.slug }) },
  ];

  const hpScale = Math.max(va.hp, vb.hp);

  const profile: { label: string; a: string; b: string; win?: 'a' | 'b' }[] = [
    { label: t.class, a: a.tags.map((tag) => CLASSES[locale][tag].label).join(', '), b: b.tags.map((tag) => CLASSES[locale][tag].label).join(', ') },
    {
      label: t.positions,
      a: a.positions.map((p) => POSITIONS[locale][p].short).join(', ') || t.noData,
      b: b.positions.map((p) => POSITIONS[locale][p].short).join(', ') || t.noData,
    },
    { label: t.attack, a: ATTACK_TYPES[locale][a.attackType] ?? t.noData, b: ATTACK_TYPES[locale][b.attackType] ?? t.noData },
    { label: t.damage, a: DAMAGE_TYPES[locale][a.damageType] ?? t.noData, b: DAMAGE_TYPES[locale][b.damageType] ?? t.noData },
    { label: t.resource, a: a.partype, b: b.partype },
    { label: t.difficulty, a: DIFFICULTY[locale][a.difficulty], b: DIFFICULTY[locale][b.difficulty] },
  ];

  return (
    <div className={styles.view}>
      <div className={styles.duel}>
        {sides.map(({ side, c, v, label, pick }) => (
          <div key={side} className={styles.side} data-side={side}>
            <img className={styles.splash} src={img.centered(c.id)} alt="" width={1280} height={720} />
            <div className={styles.sideBody}>
              <p className={styles.sideLabel}>{label}</p>
              <div className={styles.who}>
                <ViewTransition name={`champ-${c.id}`} share="morph" default="none">
                  <img className={styles.portrait} src={img.icon(c.id)} alt="" width={72} height={72} />
                </ViewTransition>
                <div>
                  <Link href={championHref(c.slug)} transitionTypes={['nav-forward']} className={styles.name}>
                    {c.name}
                  </Link>
                  <p className={styles.title}>{c.title}</p>
                </div>
              </div>
              <ResourceBar
                value={v.hp}
                scaleMax={hpScale}
                color={side === 'blue' ? 'var(--ally)' : 'var(--enemy)'}
                reverse={side === 'red'}
                size="lg"
                label={t.health(c.name)}
                caption={fmt(v.hp, 0, locale)}
              />
              <EntityPicker side={side} current={c} items={champions} onPick={pick} iconUrl={img.icon} label={t.change} placeholder={t.search} />
            </div>
          </div>
        ))}
        <span className={styles.vs} aria-hidden="true">
          {t.vs}
        </span>
      </div>

      <div className={styles.level}>
        <LevelControl value={level} onChange={(l) => go({ level: l })} id="compare-level" />
        <p>{t.ticks}</p>
      </div>

      <div className={styles.rows}>
        {ROWS.map((key) => {
          const x = va[key];
          const y = vb[key];
          const fx = fmtStat(key, x, locale);
          const fy = fmtStat(key, y, locale);
          const max = maxOf(key);
          const lead = fx === fy ? null : x > y ? 'a' : 'b';
          const diff = lead ? (Math.max(x, y) / Math.min(x, y) - 1) * 100 : 0;
          return (
            <div key={key} className={styles.row}>
              <span className={`num ${styles.val} ${lead === 'a' ? styles.winA : ''}`}>{fx}</span>
              <span className={`${styles.track} ${styles.trackA}`} aria-hidden="true">
                <i style={{ width: `${(x / max) * 100}%` }} />
              </span>
              <span className={styles.label}>
                <Icon name={STATS[locale][key].icon} size={15} />
                {STATS[locale][key].short}
                <small className={lead === 'a' ? styles.winA : lead === 'b' ? styles.winB : undefined}>
                  {lead ? t.more(fmt(diff, diff < 10 ? 1 : 0, locale), lead === 'a' ? a.name : b.name) : t.even}
                </small>
              </span>
              <span className={`${styles.track} ${styles.trackB}`} aria-hidden="true">
                <i style={{ width: `${(y / max) * 100}%` }} />
              </span>
              <span className={`num ${styles.val} ${styles.valB} ${lead === 'b' ? styles.winB : ''}`}>{fy}</span>
            </div>
          );
        })}
      </div>

      <div className={styles.extras}>
        {a.playstyle && b.playstyle && (
          <section className={styles.card}>
            <h2>{t.playstyle}</h2>
            <p className={styles.muted}>{t.ratings}</p>
            <Radar
              axes={PLAYSTYLE_AXES[locale].map(([, l]) => l)}
              series={[
                { label: a.name, color: 'var(--ally)', values: PLAYSTYLE_AXES[locale].map(([k]) => a.playstyle![k]) },
                { label: b.name, color: 'var(--enemy)', values: PLAYSTYLE_AXES[locale].map(([k]) => b.playstyle![k]) },
              ]}
            />
            <p className={styles.legend}>
              <span className={styles.lgA}>{a.name}</span>
              <span className={styles.lgB}>{b.name}</span>
            </p>
          </section>
        )}
        <section className={styles.card}>
          <h2>{t.profile}</h2>
          <table className={styles.profile}>
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr-only">{t.param}</span>
                </th>
                <th scope="col" className={styles.thA}>
                  {a.name}
                </th>
                <th scope="col" className={styles.thB}>
                  {b.name}
                </th>
              </tr>
            </thead>
            <tbody>
              {profile.map((r) => (
                <tr key={r.label}>
                  <th scope="row">{r.label}</th>
                  <td>{r.a}</td>
                  <td>{r.b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
