// Адреса изображений и видео на CDN Riot. Можно использовать и на сервере, и в браузере.
import meta from '../data/meta.json';

export const DATA_VERSION: string = meta.version;
export const PATCH = DATA_VERSION.split('.').slice(0, 2).join('.');

const DD = 'https://ddragon.leagueoflegends.com/cdn';
const VIDEO_CDN = 'https://d28xe8vt774jo5.cloudfront.net/champion-abilities/';

export const img = {
  icon: (id: string) => `${DD}/${DATA_VERSION}/img/champion/${id}.png`,
  splash: (id: string, num = 0) => `${DD}/img/champion/splash/${id}_${num}.jpg`,
  centered: (id: string, num = 0) => `${DD}/img/champion/centered/${id}_${num}.jpg`,
  loading: (id: string, num = 0) => `${DD}/img/champion/loading/${id}_${num}.jpg`,
  tile: (id: string, num = 0) => `${DD}/img/champion/tiles/${id}_${num}.jpg`,
  spell: (file: string) => `${DD}/${DATA_VERSION}/img/spell/${file}`,
  passive: (file: string) => `${DD}/${DATA_VERSION}/img/passive/${file}`,
  item: (id: string) => `${DD}/${DATA_VERSION}/img/item/${id}.png`,
  /** руны и деревья рун: путь вида perk-images/Styles/… */
  rune: (icon: string) => `${DD}/img/${icon}`,
};

export const abilityVideo = (path: string) => ({
  webm: `${VIDEO_CDN}${path}.webm`,
  mp4: `${VIDEO_CDN}${path}.mp4`,
  poster: `${VIDEO_CDN}${path}.jpg`,
});

export const championHref = (slug: string) => `/champions/${slug}`;
