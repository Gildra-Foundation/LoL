'use client';

import { useMemo } from 'react';
import { useLocale } from '@rift/engine/i18n/LocaleProvider';
import { TierList } from '@rift/engine/tierlist/TierList';
import type { TierItem } from '@rift/engine/tierlist/model';
import { Icon } from '@/components/Icon';
import { championHref, img } from '@/lib/assets';
import { TIER_STORAGE_KEY, TIER_TEXTS, laneGroups } from '@/lib/tierlist';

/** Тир-лист LoL: линии, иконки и адреса чемпионов поверх конструктора движка. */
export function LolTierList({ items }: { items: TierItem[] }) {
  const locale = useLocale();
  // значки линий — из набора иконок LoL
  const groups = useMemo(() => laneGroups(locale).map((g) => ({ ...g, icon: <Icon name={g.all ? 'grid' : g.key} size={17} /> })), [locale]);
  return (
    <TierList
      items={items}
      groups={groups}
      iconUrl={img.icon}
      itemHref={(c) => championHref(c.slug)}
      basePath="/tier-list"
      storageKey={TIER_STORAGE_KEY}
      groupParam="lane"
      texts={TIER_TEXTS[locale]}
    />
  );
}
