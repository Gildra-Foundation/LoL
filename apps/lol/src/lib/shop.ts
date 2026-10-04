// Предметы, руны и заклинания призывателя из src/data/<язык> — только для сервера.
import 'server-only';
import enItems from '../data/en/items.json';
import enRunes from '../data/en/runes.json';
import enSpells from '../data/en/spells.json';
import ruItems from '../data/ru/items.json';
import ruRunes from '../data/ru/runes.json';
import ruSpells from '../data/ru/spells.json';
import type { Locale } from './i18n';
import type { Item } from './items';
import type { RunesData, SummonerSpell } from './runes';

const ITEMS = { ru: ruItems, en: enItems } as unknown as Record<Locale, Item[]>;
const RUNES = { ru: ruRunes, en: enRunes } as unknown as Record<Locale, RunesData>;
const SPELLS = { ru: ruSpells, en: enSpells } as unknown as Record<Locale, SummonerSpell[]>;

export const getItems = (lang: Locale) => ITEMS[lang];
export const getRunes = (lang: Locale) => RUNES[lang];
export const getSpells = (lang: Locale) => SPELLS[lang];
