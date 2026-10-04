'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale } from '@rift/engine/i18n/LocaleProvider';
import { defineMessages } from '@rift/engine/i18n/locale';
import { niceTicks } from '@rift/engine/lib/scale';
import { fmt } from '@/lib/stats';
import styles from './GrowthChart.module.css';

const MESSAGES = defineMessages({
  ru: {
    level: (n: number) => `${n} уровень`,
    chart: (name: string, average: string) => `График роста: ${name} и ${average} с 1 по 18 уровень`,
    band: 'от минимума до максимума среди всех чемпионов',
    hint: 'Нажмите на график, чтобы выбрать уровень',
  },
  en: {
    level: (n: number) => `Level ${n}`,
    chart: (name: string, average: string) => `Growth chart: ${name} and ${average} from level 1 to 18`,
    band: 'from minimum to maximum across all champions',
    hint: 'Click the chart to pick a level',
  },
});

interface GrowthChartProps {
  values: number[];
  average: number[];
  min: number[];
  max: number[];
  level: number;
  decimals: number;
  championName: string;
  averageLabel: string;
  onPickLevel: (level: number) => void;
}

const PAD = { l: 52, r: 16, t: 14, b: 30 };
// подписи уровней: на широком графике каждый уровень, на узком — опорные
const labelled = (level: number, width: number) => (width >= 900 ? true : width >= 600 ? level % 2 === 1 || level === 18 : [1, 6, 12, 18].includes(level));

/** Рост характеристики с 1 по 18 уровень: линия чемпиона, среднее по классу и коридор всех чемпионов. */
export function GrowthChart({ values, average, min, max, level, decimals, championName, averageLabel, onPickLevel }: GrowthChartProps) {
  const locale = useLocale();
  const t = MESSAGES[locale];
  const svgRef = useRef<SVGSVGElement>(null);
  const figureRef = useRef<HTMLElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  // ширина в пикселях = ширина viewBox: подписи осей остаются 12 px на любом экране
  const [W, setW] = useState(760);
  const H = W < 600 ? 220 : 280;

  useEffect(() => {
    const el = figureRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setW(Math.max(300, Math.round(entry.contentRect.width))));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const ticks = niceTicks(Math.min(...min, ...values), Math.max(...max, ...values));
  const lo = ticks[0];
  const hi = ticks[ticks.length - 1];
  const x = (i: number) => PAD.l + (i / 17) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
  const line = (vals: number[]) => vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('');
  const band = `${line(max)}${[...min]
    .map((v, i) => ({ v, i }))
    .reverse()
    .map(({ v, i }) => `L${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
    .join('')}Z`;
  const format = (v: number) => fmt(v, decimals > 1 ? 2 : decimals, locale);

  const shown = hover ?? level - 1;

  const pick = (clientX: number) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const ratio = ((clientX - rect.left) / rect.width) * W;
    return Math.max(0, Math.min(17, Math.round(((ratio - PAD.l) / (W - PAD.l - PAD.r)) * 17)));
  };

  return (
    <figure ref={figureRef} className={styles.chart}>
      <div className={styles.readout} aria-live="polite">
        <span className={styles.lvl}>{t.level(shown + 1)}</span>
        <span className={styles.own}>
          {championName} <b className="num">{format(values[shown])}</b>
        </span>
        <span className={styles.avg}>
          {averageLabel} <b className="num">{format(average[shown])}</b>
        </span>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className={styles.svg}
        role="img"
        aria-label={t.chart(championName, averageLabel.toLowerCase())}
        onPointerMove={(e) => setHover(pick(e.clientX))}
        onPointerLeave={() => setHover(null)}
        onClick={(e) => onPickLevel(pick(e.clientX) + 1)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className={styles.grid} />
            <text x={PAD.l - 10} y={y(t) + 4} textAnchor="end" className={styles.axis}>
              {format(t)}
            </text>
          </g>
        ))}
        {values.map((_, i) =>
          labelled(i + 1, W) ? (
            <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className={styles.axis}>
              {i + 1}
            </text>
          ) : null,
        )}
        <path d={band} className={styles.band} />
        <path d={line(average)} className={styles.average} />
        <path d={line(values)} className={styles.line} />
        <line x1={x(shown)} x2={x(shown)} y1={PAD.t} y2={H - PAD.b} className={styles.marker} />
        <circle cx={x(shown)} cy={y(average[shown])} r={4} className={styles.avgDot} />
        <circle cx={x(shown)} cy={y(values[shown])} r={5.5} className={styles.dot} />
      </svg>
      <figcaption className={styles.legend}>
        <span className={styles.lgLine}>{championName}</span>
        <span className={styles.lgAvg}>{averageLabel}</span>
        <span className={styles.lgBand}>{t.band}</span>
        <span className={styles.hint}>{t.hint}</span>
      </figcaption>
    </figure>
  );
}
