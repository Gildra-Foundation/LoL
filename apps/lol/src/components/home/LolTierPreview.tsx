'use client';

import { useLocale } from '@rift/engine/i18n/LocaleProvider';
import { TierPreview } from '@rift/engine/tierlist/TierPreview';
import { img } from '@/lib/assets';
import { TIER_STORAGE_KEY, laneGroups } from '@/lib/tierlist';

/** Превью тир-листа на главной: расстановка игрока из этого браузера. */
export function LolTierPreview() {
  const locale = useLocale();
  return <TierPreview storageKey={TIER_STORAGE_KEY} groups={laneGroups(locale)} iconUrl={img.icon} />;
}
