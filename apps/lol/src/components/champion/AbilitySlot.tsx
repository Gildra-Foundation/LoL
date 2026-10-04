'use client';

import { useMessages } from '@rift/engine/i18n/LocaleProvider';
import { defineMessages } from '@rift/engine/i18n/locale';
import { Keycap } from '@rift/engine/ui/Keycap';
import { useChampion, type AbilityKey } from './ChampionProvider';
import styles from './AbilitySlot.module.css';

const MESSAGES = defineMessages({
  ru: { passive: 'Пассивное умение', ability: (key: string) => `Умение ${key}` },
  en: { passive: 'Passive', ability: (key: string) => `${key} ability` },
});

export interface AbilityBrief {
  key: AbilityKey;
  name: string;
  icon: string;
}

interface AbilitySlotProps {
  ability: AbilityBrief;
  size?: 'sm' | 'md' | 'lg';
  /** при первом показе умения «откатываются» по очереди */
  bootDelay?: number;
  /** прокрутить к разделу умений при выборе */
  scrollOnSelect?: boolean;
  /** подпись под иконкой (в разделе умений) */
  showName?: boolean;
}

/** Ячейка умения как в HUD: иконка, клавиша, анимация перезарядки при выборе. */
export function AbilitySlot({ ability, size = 'md', bootDelay, scrollOnSelect = false, showName = false }: AbilitySlotProps) {
  const t = useMessages(MESSAGES);
  const { ability: selected, castId, selectAbility } = useChampion();
  const active = selected === ability.key;

  return (
    <button
      type="button"
      className={[styles.slot, styles[size]].join(' ')}
      aria-pressed={active}
      aria-label={`${ability.key === 'P' ? t.passive : t.ability(ability.key)}: ${ability.name}`}
      title={ability.name}
      onClick={() => selectAbility(ability.key, { scroll: scrollOnSelect })}
    >
      <span className={styles.icon}>
        <img src={ability.icon} alt="" width={64} height={64} loading="lazy" decoding="async" />
        {bootDelay !== undefined && <span className={styles.sweep} style={{ animationDelay: `${bootDelay}ms` }} />}
        {active && castId > 0 && <span key={castId} className={styles.sweep} />}
      </span>
      <Keycap size="sm" className={styles.key}>
        {ability.key}
      </Keycap>
      {showName && <span className={styles.name}>{ability.name}</span>}
    </button>
  );
}
