'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import Link from '@rift/engine/i18n/Link';
import { useLocale, useMessages } from '@rift/engine/i18n/LocaleProvider';
import { LOCALE_TAG, defineMessages } from '@rift/engine/i18n/locale';
import { Icon } from '@/components/Icon';
import { LevelControl } from '@rift/engine/ui/LevelControl';
import { championHref, img } from '@/lib/assets';
import { CLASSES, CLASS_ORDER, type ClassTag } from '@/lib/labels';
import { niceTicks } from '@rift/engine/lib/scale';
import { STATS, fmtStat, statsAtLevel, type BaseStats, type StatKey, type StatValues } from '@/lib/stats';
import styles from './StatsBoard.module.css';

export interface BoardChampion {
  id: string;
  slug: string;
  name: string;
  tags: ClassTag[];
  stats: BaseStats;
}

const COLUMNS: StatKey[] = ['hp', 'hpregen', 'attackdamage', 'attackspeed', 'armor', 'spellblock', 'movespeed', 'attackrange', 'ehp_physical', 'ehp_magic', 'aa_dps'];
const LEADER_KEYS: StatKey[] = ['hp', 'armor', 'spellblock', 'attackdamage', 'attackspeed', 'aa_dps'];
const CLASS_KEYS: StatKey[] = ['hp', 'attackdamage', 'attackspeed', 'armor', 'spellblock', 'movespeed', 'attackrange', 'ehp_physical', 'aa_dps'];
const AXES: StatKey[] = ['hp', 'armor', 'spellblock', 'attackdamage', 'attackspeed', 'movespeed', 'attackrange', 'ehp_physical', 'ehp_magic', 'aa_dps'];

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]/g, '');

const MESSAGES = defineMessages({
  ru: {
    chart: (x: string, y: string) => `Диаграмма: ${x} и ${y}`,
    tip: (xLabel: string, x: string, yLabel: string, y: string) => `${xLabel} ${x}, ${yLabel.toLowerCase()} ${y}`,
    classLabel: 'Класс',
    all: 'Все',
    top: (level: number) => `Тройка лучших на ${level} уровне`,
    everyone: (level: number) => `Все чемпионы на ${level} уровне`,
    search: 'Найти в таблице',
    sortNote: 'Нажмите на заголовок столбца, чтобы отсортировать. Чем ярче ячейка, тем ближе значение к лучшему в игре.',
    rank: '№',
    champion: 'Чемпион',
    notFound: 'В таблице нет чемпионов с таким именем.',
    classAvg: 'Средние по классам',
    classNote: 'Чемпион считается в классе по основной роли — первой в его карточке. Лучшее значение в столбце выделено.',
    scatter: 'Каждый чемпион — точка',
    xAxis: 'По горизонтали',
    yAxis: 'По вертикали',
    scatterNote: 'Цвет точки — основной класс. Выбор класса выше приглушает остальных.',
  },
  en: {
    chart: (x: string, y: string) => `Chart: ${x} and ${y}`,
    tip: (xLabel: string, x: string, yLabel: string, y: string) => `${xLabel} ${x}, ${yLabel} ${y}`,
    classLabel: 'Class',
    all: 'All',
    top: (level: number) => `Top 3 at level ${level}`,
    everyone: (level: number) => `All champions at level ${level}`,
    search: 'Find in table',
    sortNote: 'Click a column header to sort. The brighter the cell, the closer the value is to the best in the game.',
    rank: '#',
    champion: 'Champion',
    notFound: 'No champions with that name in the table.',
    classAvg: 'Class averages',
    classNote: 'A champion counts toward the class of their main role, the first one on their card. The best value in each column is highlighted.',
    scatter: 'Every champion is a dot',
    xAxis: 'Horizontal',
    yAxis: 'Vertical',
    scatterNote: 'Dot color is the main class. Picking a class above dims the rest.',
  },
});

function Scatter({ rows, xKey, yKey, cls }: { rows: { c: BoardChampion; v: StatValues }[]; xKey: StatKey; yKey: StatKey; cls: ClassTag | null }) {
  const t = useMessages(MESSAGES);
  const locale = useLocale();
  const [hover, setHover] = useState<number | null>(null);
  const W = 1000;
  const H = 520;
  const pad = { l: 64, r: 20, t: 16, b: 52 };
  const xs = rows.map((r) => r.v[xKey]);
  const ys = rows.map((r) => r.v[yKey]);
  const xt = niceTicks(Math.min(...xs), Math.max(...xs), 7);
  const yt = niceTicks(Math.min(...ys), Math.max(...ys), 5);
  const sx = (v: number) => pad.l + ((v - xt[0]) / (xt[xt.length - 1] - xt[0])) * (W - pad.l - pad.r);
  const sy = (v: number) => pad.t + (1 - (v - yt[0]) / (yt[yt.length - 1] - yt[0])) * (H - pad.t - pad.b);
  const order = rows.map((_, i) => i).sort((a, b) => Number(!cls || rows[a].c.tags.includes(cls)) - Number(!cls || rows[b].c.tags.includes(cls)));
  const h = hover !== null ? rows[hover] : null;

  return (
    <div className={styles.scatterWrap}>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.scatter} role="img" aria-label={t.chart(STATS[locale][xKey].short, STATS[locale][yKey].short)} onPointerLeave={() => setHover(null)}>
        {yt.map((t) => (
          <g key={`y${t}`}>
            <line x1={pad.l} x2={W - pad.r} y1={sy(t)} y2={sy(t)} className={styles.grid} />
            <text x={pad.l - 10} y={sy(t) + 4} textAnchor="end" className={styles.axis}>
              {fmtStat(yKey, t, locale)}
            </text>
          </g>
        ))}
        {xt.map((t) => (
          <g key={`x${t}`}>
            <line y1={pad.t} y2={H - pad.b} x1={sx(t)} x2={sx(t)} className={styles.grid} />
            <text x={sx(t)} y={H - pad.b + 20} textAnchor="middle" className={styles.axis}>
              {fmtStat(xKey, t, locale)}
            </text>
          </g>
        ))}
        <text x={(pad.l + W - pad.r) / 2} y={H - 8} textAnchor="middle" className={styles.axisTitle}>
          {STATS[locale][xKey].short}
        </text>
        <text transform={`translate(16 ${(pad.t + H - pad.b) / 2}) rotate(-90)`} textAnchor="middle" className={styles.axisTitle}>
          {STATS[locale][yKey].short}
        </text>
        {order.map((i) => {
          const r = rows[i];
          const dim = cls !== null && !r.c.tags.includes(cls);
          return (
            <circle
              key={r.c.id}
              cx={sx(r.v[xKey]).toFixed(1)}
              cy={sy(r.v[yKey]).toFixed(1)}
              r={hover === i ? 8 : 6}
              className={dim ? styles.dotDim : styles.dot}
              style={{ fill: `var(--cls-${r.c.tags[0]})` }}
              onPointerEnter={() => setHover(i)}
            />
          );
        })}
      </svg>
      {h && (
        <div className={styles.tip} style={{ left: `${(sx(h.v[xKey]) / W) * 100}%`, top: `${(sy(h.v[yKey]) / H) * 100}%` }}>
          <img src={img.icon(h.c.id)} alt="" width={36} height={36} />
          <span>
            <b>{h.c.name}</b>
            {t.tip(STATS[locale][xKey].short, fmtStat(xKey, h.v[xKey], locale), STATS[locale][yKey].short, fmtStat(yKey, h.v[yKey], locale))}
          </span>
        </div>
      )}
    </div>
  );
}

/** Рейтинги: таблица всех чемпионов на выбранном уровне, лидеры, средние по классам и диаграмма. */
export function StatsBoard({ champions }: { champions: BoardChampion[] }) {
  const t = useMessages(MESSAGES);
  const locale = useLocale();
  const [level, setLevel] = useState(1);
  const [cls, setCls] = useState<ClassTag | null>(null);
  const [sort, setSort] = useState<{ key: StatKey | 'name'; dir: 'asc' | 'desc' }>({ key: 'hp', dir: 'desc' });
  const [query, setQuery] = useState('');
  const [xKey, setXKey] = useState<StatKey>('hp');
  const [yKey, setYKey] = useState<StatKey>('armor');
  const deferredLevel = useDeferredValue(level);

  const rows = useMemo(() => champions.map((c) => ({ c, v: statsAtLevel(c.stats, deferredLevel) })), [champions, deferredLevel]);

  const range = useMemo(() => {
    const out = {} as Record<StatKey, { min: number; max: number }>;
    for (const k of COLUMNS) {
      const vals = rows.map((r) => r.v[k]);
      out[k] = { min: Math.min(...vals), max: Math.max(...vals) };
    }
    return out;
  }, [rows]);

  const inClass = (c: BoardChampion) => !cls || c.tags.includes(cls);
  const q = norm(query);
  const table = rows
    .filter((r) => inClass(r.c) && (!q || norm(r.c.name).includes(q) || norm(r.c.id).includes(q)))
    .toSorted((a, b) => {
      const d = sort.key === 'name' ? a.c.name.localeCompare(b.c.name, LOCALE_TAG[locale]) : a.v[sort.key] - b.v[sort.key];
      return (sort.dir === 'asc' ? d : -d) || a.c.name.localeCompare(b.c.name, LOCALE_TAG[locale]);
    });

  const leaders = LEADER_KEYS.map((key) => ({
    key,
    top: rows
      .filter((r) => inClass(r.c))
      .toSorted((a, b) => b.v[key] - a.v[key])
      .slice(0, 3),
  }));

  const classAvg = CLASS_ORDER.map((tag) => {
    const group = rows.filter((r) => r.c.tags[0] === tag);
    return { tag, count: group.length, avg: Object.fromEntries(CLASS_KEYS.map((k) => [k, group.reduce((s, r) => s + r.v[k], 0) / group.length])) as Record<StatKey, number> };
  });
  const best = Object.fromEntries(CLASS_KEYS.map((k) => [k, Math.max(...classAvg.map((r) => r.avg[k]))]));

  const sortBy = (key: StatKey | 'name') =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'name' ? 'asc' : 'desc' }));

  return (
    <div className={styles.board}>
      <div className={styles.controls}>
        <LevelControl value={level} onChange={setLevel} id="stats-level" />
        <div className={styles.classes} role="group" aria-label={t.classLabel}>
          <button type="button" aria-pressed={cls === null} onClick={() => setCls(null)}>
            {t.all}
          </button>
          {CLASS_ORDER.map((tag) => (
            <button key={tag} type="button" aria-pressed={cls === tag} style={{ '--c': `var(--cls-${tag})` } as React.CSSProperties} onClick={() => setCls(cls === tag ? null : tag)}>
              <Icon name={tag} size={16} />
              {CLASSES[locale][tag].plural}
            </button>
          ))}
        </div>
      </div>

      <section className={styles.section}>
        <h2>{t.top(level)}</h2>
        <div className={styles.leaders}>
          {leaders.map(({ key, top }) => (
            <div key={key} className={styles.leader} style={{ '--accent': STATS[locale][key].color } as React.CSSProperties}>
              <h3>
                <Icon name={STATS[locale][key].icon} size={16} />
                {STATS[locale][key].short}
              </h3>
              <ol role="list">
                {top.map((r, n) => (
                  <li key={r.c.id}>
                    <span className={n === 0 ? styles.first : styles.pos}>{n + 1}</span>
                    <Link href={championHref(r.c.slug)}>
                      <img src={img.icon(r.c.id)} alt="" width={28} height={28} loading="lazy" />
                      {r.c.name}
                    </Link>
                    <span className="num">{fmtStat(key, r.v[key], locale)}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2>{t.everyone(level)}</h2>
          <label className={styles.search}>
            <Icon name="search" size={16} />
            <span className="sr-only">{t.search}</span>
            <input value={query} onChange={(e) => setQuery(e.currentTarget.value)} placeholder={t.search} />
          </label>
        </div>
        <p className={styles.note}>{t.sortNote}</p>
        <div className={styles.scroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col" className={styles.colRank}>
                  {t.rank}
                </th>
                <th scope="col" className={styles.colName} aria-sort={sort.key === 'name' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                  <button type="button" onClick={() => sortBy('name')}>
                    {t.champion}
                  </button>
                </th>
                {COLUMNS.map((k) => (
                  <th key={k} scope="col" aria-sort={sort.key === k ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                    <button type="button" onClick={() => sortBy(k)} title={STATS[locale][k].label}>
                      {STATS[locale][k].short}
                      {sort.key === k && <Icon name="chevron-down" size={13} className={sort.dir === 'asc' ? styles.up : undefined} />}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.map((r, i) => (
                <tr key={r.c.id}>
                  <td className={`num ${styles.colRank}`}>{i + 1}</td>
                  <th scope="row" className={styles.colName}>
                    <Link href={championHref(r.c.slug)}>
                      <img src={img.icon(r.c.id)} alt="" width={30} height={30} loading="lazy" />
                      <span>{r.c.name}</span>
                    </Link>
                  </th>
                  {COLUMNS.map((k) => {
                    const { min, max } = range[k];
                    const heat = (r.v[k] - min) / (max - min || 1);
                    return (
                      <td key={k} className={`num ${sort.key === k ? styles.sorted : ''}`} style={{ '--heat': heat.toFixed(3), '--accent': STATS[locale][k].color } as React.CSSProperties}>
                        {fmtStat(k, r.v[k], locale)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {table.length === 0 && <p className={styles.note}>{t.notFound}</p>}
        </div>
      </section>

      <section className={styles.section}>
        <h2>{t.classAvg}</h2>
        <p className={styles.note}>{t.classNote}</p>
        <div className={styles.scroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col" className={styles.colName}>
                  {t.classLabel}
                </th>
                {CLASS_KEYS.map((k) => (
                  <th key={k} scope="col">
                    {STATS[locale][k].short}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {classAvg.map(({ tag, count, avg }) => (
                <tr key={tag} className={cls && cls !== tag ? styles.dimRow : undefined}>
                  <th scope="row" className={styles.colName}>
                    <span className={styles.cls} style={{ '--c': `var(--cls-${tag})` } as React.CSSProperties}>
                      <Icon name={tag} size={16} />
                      {CLASSES[locale][tag].plural} <small>{count}</small>
                    </span>
                  </th>
                  {CLASS_KEYS.map((k) => (
                    <td key={k} className={`num ${avg[k] === best[k] ? styles.best : ''}`}>
                      {fmtStat(k, avg[k], locale)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2>{t.scatter}</h2>
          <div className={styles.axes}>
            <label>
              {t.xAxis}
              <select value={xKey} onChange={(e) => setXKey(e.currentTarget.value as StatKey)}>
                {AXES.map((k) => (
                  <option key={k} value={k}>
                    {STATS[locale][k].short}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t.yAxis}
              <select value={yKey} onChange={(e) => setYKey(e.currentTarget.value as StatKey)}>
                {AXES.map((k) => (
                  <option key={k} value={k}>
                    {STATS[locale][k].short}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <p className={styles.note}>{t.scatterNote}</p>
        <Scatter rows={rows} xKey={xKey} yKey={yKey} cls={cls} />
        <p className={styles.legend}>
          {CLASS_ORDER.map((tag) => (
            <span key={tag} style={{ '--c': `var(--cls-${tag})` } as React.CSSProperties}>
              {CLASSES[locale][tag].plural}
            </span>
          ))}
        </p>
      </section>
    </div>
  );
}
