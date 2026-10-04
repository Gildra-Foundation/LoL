'use client';

import { useState } from 'react';
import { AbilitySlot } from '@/components/champion/AbilitySlot';
import { ChampionProvider } from '@/components/champion/ChampionProvider';
import { LevelControl } from '@rift/engine/ui/LevelControl';
import { ResourceBar } from '@rift/engine/ui/ResourceBar';
import { img } from '@/lib/assets';
import { fmt } from '@/lib/stats';

/** Уровень и полоска здоровья вместе: видно, как с уровнем появляются деления. */
export function LevelDemo() {
  const [level, setLevel] = useState(6);
  const hp = 600 + 104 * (level - 1) * (0.7025 + 0.0175 * (level - 1));
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 520 }}>
      <LevelControl value={level} onChange={setLevel} id="demo-level" />
      <ResourceBar value={hp} label="Здоровье" caption={`${fmt(hp)} / ${fmt(hp)}`} size="lg" />
    </div>
  );
}

const ABILITIES = [
  { key: 'P', name: 'Похищение сущности', icon: img.passive('Ahri_SoulEater2.png') },
  { key: 'Q', name: 'Сфера обмана', icon: img.spell('AhriQ.png') },
  { key: 'W', name: 'Лисий огонь', icon: img.spell('AhriW.png') },
  { key: 'E', name: 'Очарование', icon: img.spell('AhriE.png') },
  { key: 'R', name: 'Призрачный рывок', icon: img.spell('AhriR.png') },
] as const;

/** Ячейки умений: выбор запускает анимацию перезарядки. Работают клавиши P Q W E R. */
export function AbilityDemo() {
  return (
    <ChampionProvider>
      <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
        {ABILITIES.map((a) => (
          <AbilitySlot key={a.key} ability={a} size="lg" showName />
        ))}
      </div>
    </ChampionProvider>
  );
}
