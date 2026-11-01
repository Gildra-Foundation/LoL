// Адреса образов, наборов и картинок CommunityDragon. Можно использовать и на сервере, и в браузере.
import meta from '../data/meta.json';

/** Патч CommunityDragon, с которого взяты данные образов: адреса с номером патча не меняются. */
export const SKINS_PATCH: string = meta.skins.cdPatch;

const CD_ASSETS = `https://raw.communitydragon.org/${SKINS_PATCH}/plugins/rcp-be-lol-game-data/global/default/`;

/** Файл клиента игры из skins.json (путь в нижнем регистре) → адрес на CommunityDragon. */
export const cdAsset = (path: string) => CD_ASSETS + path;

export const RARITY_ORDER = ['kTranscendent', 'kExalted', 'kUltimate', 'kMythic', 'kLegendary', 'kEpic', 'kRare'] as const;
export type Rarity = (typeof RARITY_ORDER)[number];

/** Редкость в адресе: /skins/rarity/legendary */
export const raritySlug = (r: Rarity) => r.slice(1).toLowerCase();
export const rarityOfSlug = (slug: string) => RARITY_ORDER.find((r) => raritySlug(r) === slug) ?? null;

export const skinHref = (slug: string) => `/skins/${slug}`;
export const lineHref = (slug: string) => `/skins/lines/${slug}`;
export const universeHref = (slug: string) => `/skins/universes/${slug}`;
export const rarityHref = (r: Rarity) => `/skins/rarity/${raritySlug(r)}`;
