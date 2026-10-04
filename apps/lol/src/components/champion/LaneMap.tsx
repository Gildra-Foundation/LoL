'use client';

import { useLocale } from '@rift/engine/i18n/LocaleProvider';
import { defineMessages } from '@rift/engine/i18n/locale';
import type { Position } from '@/lib/labels';
import { POSITIONS, POSITION_ORDER } from '@/lib/labels';
import styles from './LaneMap.module.css';

const MESSAGES = defineMessages({
  ru: { positions: (list: string) => `Позиции: ${list}`, none: 'Позиции не указаны' },
  en: { positions: (list: string) => `Positions: ${list}`, none: 'No positions listed' },
});

/**
 * Мини-карта Ущелья: подсвечены линии, на которых играют чемпиона.
 * Верхняя линия идёт по левому и верхнему краю, нижняя — по нижнему и правому, средняя — по диагонали.
 */
export function LaneMap({ positions }: { positions: Position[] }) {
  const locale = useLocale();
  const t = MESSAGES[locale];
  const on = (p: Position) => positions.includes(p);
  return (
    <figure className={styles.map}>
      <svg viewBox="0 0 200 200" role="img" aria-label={positions.length ? t.positions(positions.map((p) => POSITIONS[locale][p].label).join(', ')) : t.none}>
        <rect x="2" y="2" width="196" height="196" className={styles.ground} />
        {/* лес: четыре сектора между линиями */}
        <path d="M44 62 L92 110 L62 140 L44 140 Z" className={on('JUNGLE') ? styles.jungleOn : styles.jungle} />
        <path d="M62 44 L140 44 L140 62 L110 92 Z" className={on('JUNGLE') ? styles.jungleOn : styles.jungle} />
        <path d="M156 138 L108 90 L138 60 L156 60 Z" className={on('JUNGLE') ? styles.jungleOn : styles.jungle} />
        <path d="M138 156 L60 156 L60 138 L90 108 Z" className={on('JUNGLE') ? styles.jungleOn : styles.jungle} />
        {/* река */}
        <path d="M22 22 L178 178" className={styles.river} />
        {/* базы */}
        <path d="M2 198 L2 150 L50 198 Z" className={styles.baseBlue} />
        <path d="M198 2 L198 50 L150 2 Z" className={styles.baseRed} />
        {/* линии */}
        <path d="M24 176 L24 24 L176 24" className={on('TOP') ? styles.laneOn : styles.lane} />
        <path d="M24 176 L176 24" className={on('MIDDLE') ? styles.laneOn : styles.lane} />
        <path d="M24 176 L176 176 L176 24" className={on('BOTTOM') || on('SUPPORT') ? styles.laneOn : styles.lane} />
        {on('SUPPORT') && <circle cx="176" cy="176" r="9" className={styles.support} />}
      </svg>
      <figcaption className={styles.legend}>
        {POSITION_ORDER.map((p) => (
          <span key={p} className={on(p) ? styles.active : undefined}>
            {POSITIONS[locale][p].label}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
