'use client';

import { ViewTransition } from 'react';
import { useLocale } from '@rift/engine/i18n/LocaleProvider';
import { defineMessages } from '@rift/engine/i18n/locale';
import { Frame } from '@rift/engine/ui/Frame';
import { Icon } from '@/components/Icon';
import { LevelControl } from '@rift/engine/ui/LevelControl';
import { ResourceBar } from '@rift/engine/ui/ResourceBar';
import type { Series } from '@/lib/champions';
import { STATS, fmt, fmtStat, type StatKey } from '@/lib/stats';
import { AbilitySlot, type AbilityBrief } from './AbilitySlot';
import { useChampion } from './ChampionProvider';
import styles from './HeroHud.module.css';

const MESSAGES = defineMessages({
  ru: {
    stat: {
      attackdamage: 'Сила атаки',
      attackspeed: 'Скор. атаки',
      attackrange: 'Дальность',
      armor: 'Броня',
      spellblock: 'Сопр. магии',
      movespeed: 'Скорость',
    } as Partial<Record<StatKey, string>>,
    level: (n: number) => `Уровень ${n}`,
    health: 'Здоровье',
    noResource: 'Без ресурса: умения ничего не стоят',
    abilities: 'Умения',
  },
  en: {
    stat: {
      attackdamage: 'Atk. damage',
      attackspeed: 'Atk. speed',
      attackrange: 'Range',
      armor: 'Armor',
      spellblock: 'Magic resist',
      movespeed: 'Move speed',
    } as Partial<Record<StatKey, string>>,
    level: (n: number) => `Level ${n}`,
    health: 'Health',
    noResource: 'No resource: abilities cost nothing',
    abilities: 'Abilities',
  },
});

export interface HudData {
  id: string;
  name: string;
  portrait: string;
  partype: string;
  resourceColor: string;
  hasResource: boolean;
  series: Record<StatKey, Series>;
  abilities: AbilityBrief[];
}

const HUD_STATS: StatKey[] = ['attackdamage', 'attackspeed', 'attackrange', 'armor', 'spellblock', 'movespeed'];

/** Значение, которое коротко подсвечивается зелёным, когда растёт с уровнем. */
function Readout({ value, text }: { value: number; text: string }) {
  return (
    <span key={value} className={styles.readout}>
      {text}
    </span>
  );
}

/** Панель как внизу экрана в матче: портрет с уровнем, здоровье и ресурс с делениями, умения, характеристики. */
export function HeroHud({ data }: { data: HudData }) {
  const locale = useLocale();
  const t = MESSAGES[locale];
  const stats = STATS[locale];
  const { level, setLevel } = useChampion();
  const i = level - 1;
  const hp = data.series.hp.v[i];
  const mp = data.series.mp.v[i];

  return (
    <Frame className={styles.hud} innerClassName={styles.inner}>
      <div id="hud" className={styles.grid}>
        <div className={styles.portrait}>
          <ViewTransition name={`champ-${data.id}`} share="morph" default="none">
            <img src={data.portrait} alt="" width={120} height={120} className={styles.portraitImg} />
          </ViewTransition>
          <span className={styles.badge} aria-label={t.level(level)}>
            {level}
          </span>
        </div>

        <div className={styles.bars}>
          <ResourceBar value={hp} label={t.health} caption={`${fmt(hp, 0, locale)} / ${fmt(hp, 0, locale)}`} size="lg" boot />
          {data.hasResource ? (
            <ResourceBar value={mp} tick={0} color={data.resourceColor} label={data.partype} caption={`${fmt(mp, 0, locale)} / ${fmt(mp, 0, locale)}`} size="md" boot />
          ) : (
            <p className={styles.noResource}>{t.noResource}</p>
          )}
          <div className={styles.slots} role="group" aria-label={t.abilities}>
            {data.abilities.map((a, n) => (
              <AbilitySlot key={a.key} ability={a} bootDelay={350 + n * 90} scrollOnSelect />
            ))}
          </div>
        </div>

        <dl className={styles.stats}>
          {HUD_STATS.map((key) => (
            <div key={key} className={styles.stat} style={{ '--accent': stats[key].color } as React.CSSProperties} title={stats[key].label}>
              <dt>
                <Icon name={stats[key].icon} size={14} />
                <span>{t.stat[key]}</span>
              </dt>
              <dd className="num">
                <Readout value={data.series[key].v[i]} text={fmtStat(key, data.series[key].v[i], locale)} />
              </dd>
            </div>
          ))}
        </dl>

        <div className={styles.level}>
          <LevelControl value={level} onChange={setLevel} id="hud-level" />
        </div>
      </div>
    </Frame>
  );
}
