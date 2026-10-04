// Языки сайта и их коды в источниках Riot. Первый — основной: по нему сопоставляются данные и считаются числа.
export const LOCALES = [
  { code: 'ru', dd: 'ru_RU', cd: 'ru_ru', universe: 'ru_ru', site: 'ru_RU' },
  { code: 'en', dd: 'en_US', cd: 'default', universe: 'en_us', site: 'en_US' },
];

export const DATA = new URL('../src/data/', import.meta.url);
export const dataDir = (code) => new URL(`${code}/`, DATA);
