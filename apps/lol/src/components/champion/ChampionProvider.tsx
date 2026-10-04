'use client';

import { createContext, use, useCallback, useEffect, useMemo, useState } from 'react';

export type AbilityKey = 'P' | 'Q' | 'W' | 'E' | 'R';

interface ChampionState {
  level: number;
  setLevel: (level: number) => void;
  ability: AbilityKey;
  /** растёт при каждом выборе умения — перезапускает анимацию перезарядки */
  castId: number;
  /** выбрать умение; scroll — прокрутить к разделу умений, если его не видно */
  selectAbility: (key: AbilityKey, options?: { scroll?: boolean }) => void;
}

const ChampionContext = createContext<ChampionState | null>(null);

export function useChampion() {
  const value = use(ChampionContext);
  if (!value) throw new Error('useChampion: нет ChampionProvider');
  return value;
}

// клавиши по физическому положению — работают и на русской раскладке (Й Ц У К З)
const ABILITY_CODES: Record<string, AbilityKey> = { KeyP: 'P', KeyQ: 'Q', KeyW: 'W', KeyE: 'E', KeyR: 'R' };

function abilitiesInView() {
  const el = document.getElementById('abilities');
  if (!el) return true;
  const r = el.getBoundingClientRect();
  return r.top < window.innerHeight * 0.6 && r.bottom > window.innerHeight * 0.3;
}

/** Состояние страницы чемпиона: уровень и выбранное умение. Горячие клавиши: P Q W E R, «+» и «−». */
export function ChampionProvider({ children }: { children: React.ReactNode }) {
  const [level, setLevelState] = useState(1);
  const [ability, setAbility] = useState<AbilityKey>('P');
  const [castId, setCastId] = useState(0);

  const setLevel = useCallback((next: number) => setLevelState(Math.min(18, Math.max(1, next))), []);

  const selectAbility = useCallback((key: AbilityKey, options?: { scroll?: boolean }) => {
    setAbility(key);
    setCastId((n) => n + 1);
    if (options?.scroll && !abilitiesInView()) {
      document.getElementById('abilities')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest('input, textarea, select, [contenteditable]') || document.querySelector('dialog[open]')) return;
      const key = ABILITY_CODES[e.code];
      if (key) {
        e.preventDefault();
        selectAbility(key, { scroll: true });
      } else if (e.code === 'Equal' || e.code === 'NumpadAdd') {
        setLevelState((l) => Math.min(18, l + 1));
      } else if (e.code === 'Minus' || e.code === 'NumpadSubtract') {
        setLevelState((l) => Math.max(1, l - 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectAbility]);

  const value = useMemo(() => ({ level, setLevel, ability, castId, selectAbility }), [level, setLevel, ability, castId, selectAbility]);
  return <ChampionContext value={value}>{children}</ChampionContext>;
}
