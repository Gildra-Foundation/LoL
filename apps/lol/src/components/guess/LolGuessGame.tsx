'use client';

import { useMemo } from 'react';
import { GuessGame } from '@rift/engine/guess/GuessGame';
import { useLocale } from '@rift/engine/i18n/LocaleProvider';
import { SITE_NAME } from '@/game/site';
import { championHref, img } from '@/lib/assets';
import { GUESS_FIRST_DAY, GUESS_STORAGE_KEY, GUESS_TEXTS, guessColumns, type GuessChampion } from '@/lib/guess';

/** «Угадай чемпиона»: признаки LoL и арты чемпионов поверх игры движка. */
export function LolGuessGame({ champions }: { champions: GuessChampion[] }) {
  const locale = useLocale();
  const columns = useMemo(() => guessColumns(locale), [locale]);
  return (
    <GuessGame
      items={champions}
      columns={columns}
      iconUrl={img.icon}
      artUrl={(id) => img.centered(id)}
      itemHref={(c) => championHref(c.slug)}
      firstDay={GUESS_FIRST_DAY}
      storageKey={GUESS_STORAGE_KEY}
      siteName={SITE_NAME}
      texts={GUESS_TEXTS[locale]}
    />
  );
}
