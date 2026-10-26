import 'server-only';
import type { BuildEditorProps } from '@/components/builds/BuildEditor';
import { getChampions } from './champions';
import { LOCALE_TAG, type Locale } from './i18n';
import { getItems, getRunes, getSpells } from './shop';
export function getBuildData(lang: Locale): BuildEditorProps {
  return {
    champions: getChampions(lang).map((c) => ({
      id: c.id, slug: c.slug, name: c.name, title: c.title, positions: c.positions,
      damageType: c.tactical?.damageType ?? 'kPhysical', partype: c.partype, resource: c.resource, stats: c.stats,
    })).sort((a, b) => a.name.localeCompare(b.name, LOCALE_TAG[lang])),
    items: getItems(lang), runes: getRunes(lang), spells: getSpells(lang),
  };
}
