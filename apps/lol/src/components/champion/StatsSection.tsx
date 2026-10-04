'use client';

import { useState } from 'react';
import { Icon } from '@/components/Icon';
import { useLocale } from '@rift/engine/i18n/LocaleProvider';
import { defineMessages } from '@rift/engine/i18n/locale';
import type { Series } from '@/lib/champions';
import { STATS, fmt, fmtStat, type StatKey } from '@/lib/stats';
import { useChampion } from './ChampionProvider';
import { GrowthChart } from './GrowthChart';
import styles from './StatsSection.module.css';

const MESSAGES = defineMessages({
  ru: {
    rankTitle: (total: number) => `Место среди ${total} чемпионов`,
    rankBefore: '',
    rankAfter: ' место',
    unranked: 'без рейтинга',
    even: 'как в среднем',
    stat: 'Характеристика',
    atLevel: (level: number) => `На ${level} уровне`,
    baseGrowth: 'База и рост',
    rank: 'Место',
    vsAverage: (among: string) => `Относительно среднего ${among}`,
    title: (level: number) => `Характеристики на ${level} уровне`,
    lead: (total: number, among: string) =>
      `Без предметов и рун. Место — среди всех ${total} чемпионов. Полоска показывает значение между самым низким и самым высоким в игре, синяя отметка — среднее ${among}.`,
    derived: 'Расчётные показатели',
    growth: 'Как растут характеристики',
    chartStat: 'Характеристика на графике',
    average: (among: string) => `Среднее ${among}`,
  },
  en: {
    rankTitle: (total: number) => `Rank among ${total} champions`,
    rankBefore: '#',
    rankAfter: '',
    unranked: 'unranked',
    even: 'average',
    stat: 'Stat',
    atLevel: (level: number) => `At level ${level}`,
    baseGrowth: 'Base and growth',
    rank: 'Rank',
    vsAverage: (among: string) => `Relative to average ${among}`,
    title: (level: number) => `Stats at level ${level}`,
    lead: (total: number, among: string) =>
      `Without items or runes. Rank is among all ${total} champions. The bar places the value between the lowest and highest in the game; the blue mark is the average ${among}.`,
    derived: 'Derived stats',
    growth: 'How stats grow',
    chartStat: 'Stat on the chart',
    average: (among: string) => `Average ${among}`,
  },
});

export interface StatRowData {
  key: StatKey;
  label: string;
  /** «590, +104 за уровень» */
  base: string;
}

interface StatsSectionProps {
  name: string;
  total: number;
  among: string;
  series: Record<StatKey, Series>;
  rows: StatRowData[];
  derived: StatRowData[];
}

const CHART_KEYS: StatKey[] = ['hp', 'attackdamage', 'armor', 'spellblock', 'attackspeed', 'ehp_physical', 'aa_dps'];

function rankTone(rank: number, total: number) {
  if (rank <= 3) return styles.podium;
  if (rank <= Math.ceil(total * 0.25)) return styles.high;
  if (rank > total * 0.75) return styles.low;
  return undefined;
}

function Row({ row, series, i, total }: { row: StatRowData; series: Series; i: number; total: number }) {
  const locale = useLocale();
  const t = MESSAGES[locale];
  const def = STATS[locale][row.key];
  const value = series.v[i];
  const ranked = series.r.length > 0;
  const span = ranked ? series.max[i] - series.min[i] || 1 : 1;
  const fill = ranked ? ((value - series.min[i]) / span) * 100 : 0;
  const avgPos = ranked ? ((series.avg[i] - series.min[i]) / span) * 100 : 0;
  const delta = ranked ? ((value - series.avg[i]) / (series.avg[i] || 1)) * 100 : 0;

  return (
    <tr style={{ '--accent': def.color } as React.CSSProperties}>
      <th scope="row">
        <Icon name={def.icon} size={17} />
        <span>{row.label}</span>
      </th>
      <td className={styles.value}>
        <span key={value} className={`num ${styles.flash}`}>
          {fmtStat(row.key, value, locale)}
        </span>
      </td>
      <td className={styles.base}>{row.base}</td>
      <td className={styles.rank}>
        {ranked ? (
          <span className={rankTone(series.r[i], total)} title={t.rankTitle(total)}>
            {t.rankBefore}
            <b className="num">{series.r[i]}</b>
            {t.rankAfter}
          </span>
        ) : (
          <span className={styles.na}>{t.unranked}</span>
        )}
      </td>
      <td className={styles.compare}>
        {ranked && (
          <div className={styles.cmp}>
            <span className={styles.meter} aria-hidden="true">
              <i className={styles.meterFill} style={{ width: `${fill}%` }} />
              <i className={styles.meterAvg} style={{ left: `${avgPos}%` }} />
            </span>
            <span className={Math.abs(delta) < 0.5 ? styles.even : delta > 0 ? styles.up : styles.down}>
              {Math.abs(delta) < 0.5 ? t.even : `${delta > 0 ? '+' : '−'}${fmt(Math.abs(delta), 0, locale)}%`}
            </span>
          </div>
        )}
      </td>
    </tr>
  );
}

/** Таблица характеристик на выбранном уровне и график роста. */
export function StatsSection({ name, total, among, series, rows, derived }: StatsSectionProps) {
  const locale = useLocale();
  const t = MESSAGES[locale];
  const stats = STATS[locale];
  const { level, setLevel } = useChampion();
  const [chartKey, setChartKey] = useState<StatKey>('hp');
  const i = level - 1;
  const chart = series[chartKey];

  const head = (
    <thead>
      <tr>
        <th scope="col">{t.stat}</th>
        <th scope="col">{t.atLevel(level)}</th>
        <th scope="col">{t.baseGrowth}</th>
        <th scope="col">{t.rank}</th>
        <th scope="col">{t.vsAverage(among)}</th>
      </tr>
    </thead>
  );

  return (
    <div className={styles.section}>
      <div className={styles.head}>
        <h2>{t.title(level)}</h2>
        <p>{t.lead(total, among)}</p>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.sheet}>
          {head}
          <tbody>
            {rows.map((row) => (
              <Row key={row.key} row={row} series={series[row.key]} i={i} total={total} />
            ))}
          </tbody>
        </table>
      </div>

      <h3 className={styles.sub}>{t.derived}</h3>
      <div className={styles.tableWrap}>
        <table className={styles.sheet}>
          {head}
          <tbody>
            {derived.map((row) => (
              <Row key={row.key} row={row} series={series[row.key]} i={i} total={total} />
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.growth}>
        <div className={styles.growthHead}>
          <h3>{t.growth}</h3>
          <div className={styles.switch} role="group" aria-label={t.chartStat}>
            {CHART_KEYS.map((key) => (
              <button key={key} type="button" aria-pressed={chartKey === key} onClick={() => setChartKey(key)}>
                {stats[key].short}
              </button>
            ))}
          </div>
        </div>
        <GrowthChart
          values={chart.v}
          average={chart.avg}
          min={chart.min}
          max={chart.max}
          level={level}
          decimals={stats[chartKey].decimals}
          championName={name}
          averageLabel={t.average(among)}
          onPickLevel={setLevel}
        />
      </div>
    </div>
  );
}
