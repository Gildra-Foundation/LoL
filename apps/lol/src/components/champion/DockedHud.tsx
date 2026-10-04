'use client';

import { useEffect, useState } from 'react';
import { useLocale } from '@rift/engine/i18n/LocaleProvider';
import { defineMessages } from '@rift/engine/i18n/locale';
import { LevelControl } from '@rift/engine/ui/LevelControl';
import { ResourceBar } from '@rift/engine/ui/ResourceBar';
import { fmt } from '@/lib/stats';
import { AbilitySlot } from './AbilitySlot';
import { useChampion } from './ChampionProvider';
import type { HudData } from './HeroHud';
import styles from './DockedHud.module.css';

const MESSAGES = defineMessages({
  ru: { health: 'Здоровье', abilities: 'Умения' },
  en: { health: 'Health', abilities: 'Abilities' },
});

/** Когда большая панель уходит за край экрана, внизу закрепляется компактная — уровень и умения всегда под рукой. */
export function DockedHud({ data }: { data: HudData }) {
  const locale = useLocale();
  const t = MESSAGES[locale];
  const { level, setLevel } = useChampion();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const target = document.getElementById('hud');
    if (!target) return;
    const observer = new IntersectionObserver(([entry]) => setShown(!entry.isIntersecting && entry.boundingClientRect.top < 0), {
      threshold: 0,
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const hp = data.series.hp.v[level - 1];

  return (
    <div className={styles.dock} data-shown={shown} aria-hidden={!shown} inert={!shown}>
      <div className={styles.panel}>
        <img src={data.portrait} alt="" width={40} height={40} className={styles.portrait} />
        <div className={styles.who}>
          <span className={styles.name}>{data.name}</span>
          <ResourceBar value={hp} label={t.health} caption={fmt(hp, 0, locale)} size="md" />
        </div>
        <LevelControl value={level} onChange={setLevel} compact />
        <div className={styles.slots} role="group" aria-label={t.abilities}>
          {data.abilities.map((a) => (
            <AbilitySlot key={a.key} ability={a} size="sm" scrollOnSelect />
          ))}
        </div>
      </div>
    </div>
  );
}
